// Servicio de generación de mensajes (port del GenService original)
// Jobs en memoria + suscripción de UI + persistencia a Supabase

import { callAnthropic, type AnthropicResponse } from "./api";
import { messagesRepo, segmentsRepo } from "./db";
import type {
  BullseyeContact,
  BullseyeCampaign,
  BullseyeSegment,
  BullseyeSource,
  BullseyeMessage,
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

// ─── Prompt builders ─────────────────────────────────────────────────────
function buildPrompt(
  contact: BullseyeContact,
  campaign: BullseyeCampaign,
  segment: BullseyeSegment,
  client: Client | null,
  sources: BullseyeSource[],
  directives: string,
): { prompt: string; pdfDocs: Array<Record<string, unknown>>; useSearch: boolean } {
  const pdfDocs = sources
    .filter(s => s.type === "pdf" && (s.storage_path || s.content))
    .map(s => ({
      type: "document",
      source: s.content
        ? { type: "base64", media_type: "application/pdf", data: s.content }
        : { type: "url", url: s.storage_path! },
      title: s.name,
    }));

  const urlSources = sources.filter(s => s.type === "url" && s.storage_path);
  const useSearch = urlSources.length > 0;

  const parts: string[] = [
    `Eres un experto en outreach B2B hiperpersonalizado para la empresa "${client?.name || "cliente"}".`,
    "",
  ];

  if (client?.description) parts.push(`Descripción de ${client.name}: ${client.description}`, "");

  parts.push(
    `CAMPAÑA: ${campaign.name}`,
    campaign.objective ? `Objetivo: ${campaign.objective}` : "",
    campaign.icp ? `ICP: ${campaign.icp}` : "",
    "",
    `SEGMENTO: ${segment.name}`,
    segment.description ? `Descripción del segmento: ${segment.description}` : "",
    "",
    `CONTACTO:`,
    `Nombre: ${contact.name}`,
    contact.title ? `Cargo: ${contact.title}` : "",
    contact.company ? `Empresa: ${contact.company}` : "",
    contact.industry ? `Industria: ${contact.industry}` : "",
    contact.location ? `Ubicación: ${contact.location}` : "",
    contact.linkedin_url ? `LinkedIn: ${contact.linkedin_url}` : "",
    contact.email ? `Email: ${contact.email}` : "",
    "",
  );

  if (pdfDocs.length > 0) {
    parts.push("FUENTES DE CONOCIMIENTO: Ver documentos PDF adjuntos.", "");
  }

  if (urlSources.length > 0) {
    parts.push(
      "FUENTES WEB (busca información actualizada de estas URLs):",
      ...urlSources.map(s => `- ${s.storage_path}`),
      "",
    );
  }

  const channels: Channel[] = ["linkedin", "email", "whatsapp"];

  parts.push(
    "TAREA: Genera mensajes de outreach hiperpersonalizados para este contacto.",
    "",
    directives ? `DIRECTRICES ADICIONALES:\n${directives}\n` : "",
    "Devuelve SOLO un objeto JSON con esta estructura exacta (sin bloques markdown):",
    JSON.stringify({
      linkedin: channels.includes("linkedin") ? ["mensaje linkedin 1", "mensaje linkedin 2 (seguimiento)"] : undefined,
      email: channels.includes("email")
        ? [{ subject: "asunto 1", body: "cuerpo 1" }, { subject: "asunto 2", body: "cuerpo 2 (seguimiento)" }]
        : undefined,
      whatsapp: channels.includes("whatsapp") ? ["mensaje whatsapp 1"] : undefined,
    }),
  );

  return { prompt: parts.filter(p => p !== null).join("\n"), pdfDocs, useSearch };
}

// ─── GenService public API ────────────────────────────────────────────────
export async function generateMessagesForContact(
  contact: BullseyeContact,
  campaign: BullseyeCampaign,
  segment: BullseyeSegment,
  client: Client | null,
  sources: BullseyeSource[],
  directives: string,
): Promise<BullseyeMessage> {
  const { prompt, pdfDocs, useSearch } = buildPrompt(contact, campaign, segment, client, sources, directives);

  const tools = useSearch
    ? [{ name: "web_search", description: "Search the web", input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } }]
    : undefined;

  const messageContent = pdfDocs.length > 0
    ? [...pdfDocs, { type: "text", text: prompt }]
    : [{ type: "text", text: prompt }];

  const resp: AnthropicResponse = await callAnthropic({
    messages: [{ role: "user", content: messageContent }],
    tools,
    max_tokens: 2000,
  });

  const m = resp.text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no devolvió JSON válido");
  return JSON.parse(m[0]) as BullseyeMessage;
}

export async function generatePersona(
  campaign: BullseyeCampaign,
  contacts: BullseyeContact[],
  client: Client | null,
): Promise<{ name: string; description: string; pain_points: string[]; goals: string[]; communication_style: string }> {
  const contactsSummary = contacts.slice(0, 10).map(c =>
    [c.name, c.title, c.company, c.industry].filter(Boolean).join(" | ")
  ).join("\n");

  const prompt = [
    `Eres experto en marketing B2B. Analiza estos contactos de la campaña "${campaign.name}" de la empresa "${client?.name || "cliente"}" y crea un buyer persona representativo.`,
    "",
    `Objetivo de la campaña: ${campaign.objective || "No especificado"}`,
    `ICP: ${campaign.icp || "No especificado"}`,
    "",
    "MUESTRA DE CONTACTOS:",
    contactsSummary,
    "",
    "Responde SOLO con JSON válido (sin bloques markdown):",
    `{"name":"Nombre del Persona","description":"Descripción en 2-3 oraciones","pain_points":["dolor 1","dolor 2","dolor 3"],"goals":["objetivo 1","objetivo 2"],"communication_style":"Descripción del estilo de comunicación preferido"}`
  ].join("\n");

  const resp = await callAnthropic({
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    max_tokens: 1000,
  });

  const m = resp.text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no devolvió JSON válido para el persona");
  return JSON.parse(m[0]);
}

// ─── Job runner ───────────────────────────────────────────────────────────
interface RunOpts {
  segId: string;
  label: string;
  toProcess: BullseyeContact[];
  campaign: BullseyeCampaign;
  segment: BullseyeSegment;
  client: Client | null;
  sources: BullseyeSource[];
  directives: string;
  onProgress?: (current: number, total: number) => void;
}

const CONCURRENCY = 5;

export async function GenService(opts: RunOpts): Promise<void> {
  const job: Job = { segId: opts.segId, current: 0, total: opts.toProcess.length, cancelled: false, label: opts.label };
  _jobs.set(opts.segId, job);
  notify();

  const queue = [...opts.toProcess];

  const processContact = async (contact: BullseyeContact) => {
    let attempts = 0;
    while (attempts < 3) {
      try {
        const msg = await generateMessagesForContact(
          contact,
          opts.campaign,
          opts.segment,
          opts.client,
          opts.sources,
          opts.directives,
        );
        await messagesRepo.upsert(opts.segId, contact.id, msg);
        break;
      } catch (e) {
        attempts++;
        if (attempts >= 3) {
          const errMsg: BullseyeMessage = { _error: String(e) };
          await messagesRepo.upsert(opts.segId, contact.id, errMsg);
          break;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    job.current++;
    notify();
    opts.onProgress?.(job.current, job.total);
  };

  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0 && !job.cancelled) {
      const contact = queue.shift()!;
      await processContact(contact);
    }
  });

  await Promise.all(workers);

  await segmentsRepo.setGeneratedAt(opts.segId);
  _jobs.delete(opts.segId);
  notify();
}

export function cancelJob(segId: string) {
  const job = _jobs.get(segId);
  if (job) { job.cancelled = true; notify(); }
}

export function subscribeJobs(fn: Listener): () => void {
  _listeners.add(fn);
  fn(new Map(_jobs));
  return () => _listeners.delete(fn);
}

// ─── Error helper ─────────────────────────────────────────────────────────
export function isErrorMsg(m: { linkedin?: string[]; email?: { subject?: string; body?: string }[]; whatsapp?: string[] }) {
  return "_error" in m;
}

// ─── Simulation types ─────────────────────────────────────────────────────
export interface SimulationResult {
  open_rate: number;
  response_rate: number;
  interest_score: number;
  interest_level: "alto" | "medio" | "bajo";
  reactions: Array<{
    contact_name: string;
    channel: string;
    opens: boolean;
    responds: boolean;
    interest: "alto" | "medio" | "bajo";
    comment: string;
  }>;
  insights: {
    strengths: string[];
    weaknesses: string[];
    suggestions: string[];
  };
}

export async function simulateMessages(
  messages: BullseyeMessage[],
  contacts: BullseyeContact[],
  persona: { name: string; description: string; pain_points: string[]; goals: string[]; communication_style: string } | null,
  campaign: BullseyeCampaign,
): Promise<SimulationResult> {
  const sample = messages.filter(m => !isErrorMsg(m)).slice(0, 6);
  const contactSample = contacts.slice(0, 6);

  const messagesText = sample.map((m, i) => {
    const lines: string[] = [`--- Mensaje ${i + 1} (${contactSample[i]?.name || "Contacto"}) ---`];
    if (m.linkedin?.length) lines.push(`LinkedIn: ${m.linkedin[0]}`);
    if (m.email?.length) lines.push(`Email subject: ${m.email[0].subject}\nEmail body: ${m.email[0].body}`);
    if (m.whatsapp?.length) lines.push(`WhatsApp: ${m.whatsapp[0]}`);
    return lines.join("\n");
  }).join("\n\n");

  const prompt = [
    "Eres experto en outreach B2B. Simula la reacción realista de una audiencia virtual ante estos mensajes.",
    "",
    `CAMPAÑA: ${campaign.name}`,
    campaign.objective ? `Objetivo: ${campaign.objective}` : "",
    "",
    persona ? `BUYER PERSONA: ${persona.name}\n${persona.description}\nEstilo: ${persona.communication_style}` : "BUYER PERSONA: Decisor B2B genérico",
    "",
    "MENSAJES GENERADOS:",
    messagesText,
    "",
    "TAREA:",
    "1. Simula 6 reacciones ficticias realistas de prospectos que reciben estos mensajes.",
    "2. Calcula métricas realistas (benchmarks: LinkedIn apertura 30-50%, email 20-35%, respuesta 5-20%).",
    "3. Genera insights concretos sobre fortalezas, debilidades y sugerencias de mejora.",
    "",
    "Responde SOLO con JSON válido (sin bloques markdown):",
    `{"open_rate":35,"response_rate":12,"interest_score":58,"interest_level":"medio","reactions":[{"contact_name":"Nombre","channel":"linkedin","opens":true,"responds":false,"interest":"medio","comment":"Comentario"}],"insights":{"strengths":["fortaleza 1"],"weaknesses":["debilidad 1"],"suggestions":["sugerencia 1"]}}`,
  ].join("\n");

  const resp = await callAnthropic({
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    max_tokens: 2500,
  });

  const m = resp.text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no devolvió JSON válido en la simulación");
  return JSON.parse(m[0]) as SimulationResult;
}

export async function simulateSequence(
  sequenceText: string,
  sequencePdf: { content: string; name: string } | null,
  channels: string[],
  objective: string,
  industry: string,
  role: string,
): Promise<SimulationResult> {
  const chanList = channels.join(", ");

  const prompt = [
    "Eres experto en evaluación de secuencias de outreach B2B. Simula la reacción realista de una audiencia virtual.",
    "",
    "PARÁMETROS:",
    `Objetivo: ${objective || "No especificado"}`,
    `Industria: ${industry || "B2B"}`,
    `Rol objetivo: ${role || "Decisor"}`,
    `Canales activos: ${chanList}`,
    "",
    sequencePdf
      ? "SECUENCIA: ver documento PDF adjunto."
      : `SECUENCIA DE OUTREACH:\n${sequenceText.slice(0, 4000)}`,
    "",
    "TAREA:",
    "1. Crea 6 perfiles ficticios representativos del rol y la industria indicados.",
    "2. Simula cómo cada perfil reaccionaría a esta secuencia de outreach.",
    "3. Calcula métricas realistas vs benchmarks B2B (LinkedIn ~25-45% apertura, email ~20-35%, respuesta típica 5-20%).",
    "4. Genera insights concretos y accionables. Sé crítico y honesto.",
    "",
    "Responde SOLO con JSON válido (sin bloques markdown):",
    `{"open_rate":35,"response_rate":12,"interest_score":58,"interest_level":"medio","reactions":[{"contact_name":"Nombre Ficticio","channel":"linkedin","opens":true,"responds":false,"interest":"medio","comment":"Comentario específico de 1 oración"}],"insights":{"strengths":["punto fuerte 1","punto fuerte 2"],"weaknesses":["debilidad 1","debilidad 2"],"suggestions":["sugerencia accionable 1","sugerencia accionable 2","sugerencia accionable 3"]}}`,
  ].join("\n");

  const messageContent = sequencePdf
    ? [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: sequencePdf.content },
          title: sequencePdf.name,
        },
        { type: "text", text: prompt },
      ]
    : [{ type: "text", text: prompt }];

  const resp = await callAnthropic({
    messages: [{ role: "user", content: messageContent }],
    max_tokens: 3000,
  });

  const m2 = resp.text.match(/\{[\s\S]*\}/);
  if (!m2) throw new Error("La IA no devolvió JSON válido en la simulación de secuencia");
  return JSON.parse(m2[0]) as SimulationResult;
}

export async function applySequenceSuggestions(
  sequenceText: string,
  sequencePdf: { content: string; name: string } | null,
  suggestions: string[],
  channels: string[],
  objective: string,
  industry: string,
  role: string,
): Promise<string> {
  const suggestionList = suggestions.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const prompt = [
    "Eres experto en copywriting B2B y secuencias de outreach. Tu tarea es reescribir y mejorar una secuencia de mensajes.",
    "",
    "PARÁMETROS:",
    `Objetivo: ${objective || "No especificado"}`,
    `Industria: ${industry || "B2B"}`,
    `Rol objetivo: ${role || "Decisor"}`,
    `Canales activos: ${channels.join(", ")}`,
    "",
    sequencePdf
      ? "SECUENCIA ORIGINAL: ver documento PDF adjunto."
      : `SECUENCIA ORIGINAL:\n${sequenceText.slice(0, 4000)}`,
    "",
    "SUGERENCIAS A APLICAR OBLIGATORIAMENTE:",
    suggestionList,
    "",
    "INSTRUCCIONES:",
    "- Reescribe la secuencia completa incorporando todas las sugerencias anteriores.",
    "- Mantén la misma estructura de mensajes y canales.",
    "- Mejora el copy sin cambiar la voz ni el tono general del remitente.",
    "- Devuelve SOLO la secuencia mejorada, sin explicaciones adicionales.",
  ].join("\n");

  const messageContent = sequencePdf
    ? [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: sequencePdf.content },
          title: sequencePdf.name,
        },
        { type: "text", text: prompt },
      ]
    : [{ type: "text", text: prompt }];

  const resp = await callAnthropic({
    messages: [{ role: "user", content: messageContent }],
    max_tokens: 4000,
  });

  return resp.text.trim();
}
