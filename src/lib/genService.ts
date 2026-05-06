// Servicio de generación de mensajes (port del GenService original)
// Jobs en memoria + suscripción de UI + persistencia a Supabase

import { callAnthropic, type AnthropicResponse } from "./api";
import { messagesRepo, segmentsRepo } from "./db";
import type {
  BullseyeContact,
  BullseyeCampaign,
  BullseyeSegment,
  BullseyeSource,
  Client,
  Channel,
} from "../types/db";

interface Job {
  segId: string;
  current: number;
  total: number;
  cancelled: boolean;
  label: string;
}

type Listener = (jobs: Map<string, Job>) => void;

const _jobs = new Map<string, Job>();
const _listeners = new Set<Listener>();
const notify = () => {
  const snapshot = new Map(_jobs);
  _listeners.forEach(fn => fn(snapshot));
};

// ─── Prompt builders ──────────────────────────────────────────────────────────
function buildPrompt(
  contact: BullseyeContact,
  campaign: BullseyeCampaign,
  segment: BullseyeSegment,
  client: Client | null,
  sources: BullseyeSource[],
  directives: string,
): { prompt: string; pdfDocs: Array<Record<string, unknown>>; useSearch: boolean } {
  const pdfDocs = sources
    .filter(s => s.type === "pdf" && s.storage_path)
    .map(s => ({
      type: "document",
      source: { type: "url", url: s.storage_path! },
      title: s.name,
    }));

  const urlCtx = sources.filter(s => s.type === "url").map(s => "Web: " + s.url).join("\n");
  const txtCtx = sources
    .filter(s => s.type === "text")
    .map(s => (s.content || "").slice(0, 400))
    .join("\n");

  const segCtx = `Segmento: ${segment.name}${segment.criteria ? " (" + segment.criteria + ")" : ""}`;
  const chans = (campaign.channels || ["linkedin", "email"]) as Channel[];
  const mpc = campaign.msgs_per_channel || ({} as Record<Channel, number>);
  const nLi = chans.includes("linkedin") ? mpc.linkedin || 1 : 0;
  const nEm = chans.includes("email") ? mpc.email || 1 : 0;
  const nWa = chans.includes("whatsapp") ? mpc.whatsapp || 1 : 0;

  const researchLines: string[] = [];
  if (contact.website) researchLines.push("- Web empresa: " + contact.website);
  if (contact.linkedin) researchLines.push("- LinkedIn: " + contact.linkedin);
  if (contact.company && !contact.website) researchLines.push("- Busca noticias de: " + contact.company);
  const researchCtx = researchLines.length
    ? "INVESTIGACION PREVIA: Usa web_search:\n" + researchLines.join("\n") + "\nMenciona algo especifico encontrado."
    : "";
  const useSearch = researchLines.length > 0;

  const liEx = nLi === 1 ? '["msg"]' : "[" + Array.from({ length: nLi }, () => '""').join(",") + "]";
  const emEx = "[" + Array.from({ length: nEm }, () => '{"subject":"...","body":"..."}').join(",") + "]";
  const waEx = nWa === 1 ? '["msg"]' : "[" + Array.from({ length: nWa }, () => '""').join(",") + "]";
  const jsonShape = [
    nLi > 0 ? '"linkedin":' + liEx : null,
    nEm > 0 ? '"email":' + emEx : null,
    nWa > 0 ? '"whatsapp":' + waEx : null,
  ].filter(Boolean).join(",");

  const chanInstr = [
    nLi > 0 ? `LinkedIn: ${nLi} msg(s) max 280c` : null,
    nEm > 0 ? `Email: ${nEm} msg(s) asunto max 8 palabras cuerpo max 120 palabras` : null,
    nWa > 0 ? `WhatsApp: ${nWa} msg(s) max 150c` : null,
  ].filter(Boolean).join(" | ");

  const prompt = [
    "Eres experto en ABM B2B hiperpersonalizado. Genera mensajes de outreach.",
    `Contacto: nombre=${contact.name || ""}, cargo=${contact.title || ""}, empresa=${contact.company || ""}` +
      (contact.country ? `, pais=${contact.country}` : "") +
      (contact.decision_maker ? `, tomador=${contact.decision_maker}` : "") +
      (contact.website ? `, web=${contact.website}` : "") +
      (contact.linkedin ? `, linkedin=${contact.linkedin}` : ""),
    `Campana: objetivo=${campaign.goal || ""}, industria=${campaign.industry || ""}, cargo=${campaign.role || ""}`,
    segCtx,
    `Cliente: ${client ? client.name : ""}`,
    urlCtx,
    txtCtx,
    researchCtx,
    directives ? `DIRECTRICES: ${directives}` : "",
    `CANTIDAD EXACTA: ${chanInstr}`,
    "Mensajes humanos y especificos. msg1=inicial, siguientes=followup.",
    `Responde SOLO con JSON al final: {${jsonShape}}`,
    "Incluye SOLO canales activos.",
  ].filter(Boolean).join("\n");

  return { prompt, pdfDocs, useSearch };
}

// ─── Generar mensajes para 1 contacto ─────────────────────────────────────────
export async function generateMessagesForContact(
  contact: BullseyeContact,
  campaign: BullseyeCampaign,
  segment: BullseyeSegment,
  client: Client | null,
  sources: BullseyeSource[],
  directives: string,
): Promise<{
  linkedin: string[];
  email: { subject: string; body: string }[];
  whatsapp: string[];
  sources: { query: string; url: string }[];
}> {
  const { prompt, pdfDocs, useSearch } = buildPrompt(
    contact, campaign, segment, client, sources, directives,
  );

  const messageContent =
    pdfDocs.length > 0
      ? [...pdfDocs, { type: "text", text: prompt }]
      : [{ type: "text", text: prompt }];

  const body: Parameters<typeof callAnthropic>[0] = {
    messages: [{ role: "user", content: messageContent }],
  };
  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const resp: AnthropicResponse = await callAnthropic(body);

  try {
    const m = resp.text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : resp.text) as Record<string, unknown>;
    const li = Array.isArray(parsed.linkedin) ? (parsed.linkedin as string[]) : parsed.linkedin ? [parsed.linkedin as string] : [];
    const em = Array.isArray(parsed.email) ? (parsed.email as { subject: string; body: string }[]) : parsed.email ? [parsed.email as { subject: string; body: string }] : [];
    const wa = Array.isArray(parsed.whatsapp) ? (parsed.whatsapp as string[]) : parsed.whatsapp ? [parsed.whatsapp as string] : [];
    return { linkedin: li, email: em, whatsapp: wa, sources: resp.webSources };
  } catch {
    return {
      linkedin: ["[Error]"],
      email: [{ subject: "Error", body: resp.text.slice(0, 200) }],
      whatsapp: ["[Error]"],
      sources: resp.webSources,
    };
  }
}

// ─── Buyer persona (para simulación) ──────────────────────────────────────────
export interface PersonaShape {
  name: string;
  title: string;
  summary: string;
  pains: string[];
  motivations: string[];
  objections: string[];
  kpis: string[];
  channels: string[];
}

export async function generatePersona(
  role: string,
  industry: string,
  contactTitles: string[],
): Promise<PersonaShape> {
  const titlesCtx = contactTitles.length
    ? "Cargos reales de los contactos cargados en el segmento (úsalos como base principal):\n" +
      contactTitles.slice(0, 40).map(t => "- " + t).join("\n")
    : "Cargo referencia: " + role;

  const prompt = [
    "Crea un buyer persona B2B detallado que represente al perfil predominante de esta lista de contactos.",
    titlesCtx,
    "Industria: " + industry,
    "Analiza los cargos, identifica el perfil más común y construye el persona desde ahí.",
    'Responde SOLO con JSON: {"name":"nombre ficticio","title":"cargo representativo","summary":"2 oraciones","pains":["p1","p2","p3"],"motivations":["m1","m2"],"objections":["o1","o2"],"kpis":["k1","k2"],"channels":["c1","c2"]}',
  ].join("\n");

  const resp = await callAnthropic({
    messages: [{ role: "user", content: prompt }],
  });
  const m = resp.text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : resp.text) as PersonaShape;
}

// ─── Job runner ───────────────────────────────────────────────────────────────
export interface StartJobOpts {
  segment: BullseyeSegment;
  campaign: BullseyeCampaign;
  client: Client | null;
  sources: BullseyeSource[];
  directives: string;
  toProcess: BullseyeContact[];
  onDone?: () => void;
}

export const GenService = {
  subscribe(fn: Listener) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
  getJobs() {
    return new Map(_jobs);
  },
  isRunning(segId: string) {
    return _jobs.has(segId);
  },
  cancel(segId: string) {
    const j = _jobs.get(segId);
    if (j) j.cancelled = true;
  },
  async start(segId: string, opts: StartJobOpts) {
    if (_jobs.has(segId)) return;
    const job: Job = {
      segId,
      current: 0,
      total: opts.toProcess.length,
      cancelled: false,
      label: opts.segment.name,
    };
    _jobs.set(segId, job);
    notify();

    const MAX_RETRIES = 1;

    for (let i = 0; i < opts.toProcess.length; i++) {
      if (job.cancelled) break;
      job.current = i + 1;
      notify();

      const contact = opts.toProcess[i];
      let lastErr: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const msg = await generateMessagesForContact(
            contact, opts.campaign, opts.segment, opts.client, opts.sources, opts.directives,
          );
          await messagesRepo.upsert({
            contact_id: contact.id,
            segment_id: segId,
            approved: false,
            linkedin: msg.linkedin,
            email: msg.email,
            whatsapp: msg.whatsapp,
            sources: msg.sources,
            generated_at: new Date().toISOString(),
          });
          lastErr = null;
          break;
        } catch (e: unknown) {
          lastErr = e instanceof Error ? e : new Error(String(e));
          if (attempt < MAX_RETRIES) await new Promise(r => setTimeout(r, 2000));
        }
      }

      if (lastErr) {
        await messagesRepo.upsert({
          contact_id: contact.id,
          segment_id: segId,
          approved: false,
          linkedin: ["[Error: " + lastErr.message + "]"],
          email: [{ subject: "Error", body: lastErr.message }],
          whatsapp: ["[Error]"],
          sources: [],
        });
      }

      await new Promise(r => setTimeout(r, 600));
    }

    _jobs.delete(segId);
    await segmentsRepo.refreshCounts(segId);
    notify();
    opts.onDone?.();
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function isErrorMsg(m: { linkedin?: string[]; email?: { subject?: string; body?: string }[]; whatsapp?: string[] }) {
  const liOk = m.linkedin?.some(x => x && !x.startsWith("[Error") && x.trim() !== "");
  const emOk = m.email?.some(e => e?.body && e.body.trim() !== "" && e.subject !== "Error");
  const waOk = m.whatsapp?.some(x => x && !x.startsWith("[Error") && x.trim() !== "");
  return !liOk && !emOk && !waOk;
}
