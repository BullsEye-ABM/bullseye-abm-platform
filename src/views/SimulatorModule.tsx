import { useRef, useState } from "react";
import { simulateSequence, type SimulationResult } from "../lib/genService";
import { readBase64, readText, C, FF, uid } from "../lib/utils";
import { Badge, Btn, INP, LBL, TD, TH, card } from "../components/ui";

interface SavedSim {
  id: string;
  name: string;
  createdAt: string;
  input: {
    sequenceText: string;
    sequencePdfName: string | null;
    objective: string;
    industry: string;
    role: string;
    channels: string[];
  };
  result: SimulationResult;
}

const LS_KEY = "bullseye_simulations";

function loadSaved(): SavedSim[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") as SavedSim[]; }
  catch { return []; }
}
function persistSims(sims: SavedSim[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(sims));
}

export function SimulatorModule() {
  const [saved, setSaved] = useState<SavedSim[]>(loadSaved);
  const [selected, setSelected] = useState<SavedSim | null>(null);
  const [mode, setMode] = useState<"new" | "view">("new");

  // Form
  const [sequenceText, setSequenceText] = useState("");
  const [sequencePdf, setSequencePdf] = useState<{ content: string; name: string } | null>(null);
  const [objective, setObjective] = useState("");
  const [industry, setIndustry] = useState("");
  const [role, setRole] = useState("");
  const [channels, setChannels] = useState<string[]>(["linkedin", "email"]);

  // Run state
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simErr, setSimErr] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setSimErr(null);
    if (f.name.toLowerCase().endsWith(".pdf")) {
      const b64 = await readBase64(f);
      setSequencePdf({ content: b64, name: f.name });
      setSequenceText("");
    } else {
      try {
        const text = await readText(f);
        setSequenceText(text);
        setSequencePdf(null);
      } catch {
        setSimErr("Solo se admiten PDF o texto plano. Para Word/Google Docs, exporta como PDF.");
      }
    }
  };

  const toggleChannel = (ch: string) =>
    setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);

  const handleSimulate = async () => {
    if (simLoading) return;
    if (!sequenceText.trim() && !sequencePdf) {
      setSimErr("Ingresa el contenido de la secuencia antes de simular.");
      return;
    }
    if (channels.length === 0) {
      setSimErr("Selecciona al menos un canal.");
      return;
    }
    setSimErr(null);
    setSimLoading(true);
    try {
      const result = await simulateSequence(
        sequenceText, sequencePdf, channels, objective, industry, role,
      );
      setSimResult(result);
    } catch (e: unknown) {
      setSimErr("Error en simulación: " + (e instanceof Error ? e.message : String(e)));
    }
    setSimLoading(false);
  };

  const handleSave = () => {
    if (!simResult) return;
    const label = [
      objective || "Simulación",
      industry ? `· ${industry}` : null,
      new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "short" }),
    ].filter(Boolean).join(" ");
    const newSim: SavedSim = {
      id: uid(),
      name: label,
      createdAt: new Date().toISOString(),
      input: { sequenceText, sequencePdfName: sequencePdf?.name ?? null, objective, industry, role, channels },
      result: simResult,
    };
    const updated = [newSim, ...saved];
    setSaved(updated);
    persistSims(updated);
    setSelected(newSim);
    setMode("view");
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = saved.filter(s => s.id !== id);
    setSaved(updated);
    persistSims(updated);
    if (selected?.id === id) { setSelected(null); setMode("new"); }
  };

  const startNew = () => {
    setSelected(null); setMode("new"); setSimResult(null); setSimErr(null);
    setSequenceText(""); setSequencePdf(null);
    setObjective(""); setIndustry(""); setRole("");
    setChannels(["linkedin", "email"]);
  };

  const viewSaved = (sim: SavedSim) => { setSelected(sim); setMode("view"); setSimResult(null); };

  const resultToShow = mode === "view" && selected ? selected.result : simResult;
  const canSave = mode === "new" && simResult !== null;

  return (
    <div style={{ display: "flex", gap: "24px" }}>
      {/* ─── Left panel: saved simulations ───────────────────────────────────── */}
      <div style={{
        width: "256px", flexShrink: 0, background: C.white,
        border: "1px solid " + C.border, borderRadius: "12px",
        padding: "16px", alignSelf: "flex-start", position: "sticky", top: "32px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>Guardadas</div>
          <Btn v="sm" onClick={startNew}>+ Nueva</Btn>
        </div>

        {saved.length === 0 && (
          <div style={{ fontSize: "12px", color: C.textFaint, textAlign: "center", padding: "24px 0" }}>
            Sin simulaciones guardadas
          </div>
        )}

        {saved.map(sim => (
          <div
            key={sim.id}
            onClick={() => viewSaved(sim)}
            style={{
              padding: "10px 12px", borderRadius: "8px", cursor: "pointer",
              marginBottom: "6px",
              background: selected?.id === sim.id ? C.accentBg : "transparent",
              border: "1px solid " + (selected?.id === sim.id ? C.accent + "44" : C.border),
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 600, color: C.text, marginBottom: "4px", lineHeight: 1.3 }}>
              {sim.name}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontSize: "11px", color: C.textFaint }}>
                {new Date(sim.createdAt).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "2-digit" })}
              </div>
              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: C.success }}>{sim.result.open_rate}%</span>
                <span style={{ fontSize: "10px", color: C.textFaint }}>ap</span>
                <button
                  onClick={e => handleDelete(sim.id, e)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: C.textFaint, fontSize: "13px", padding: "0 2px", marginLeft: "4px" }}
                >✕</button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Right panel ──────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: "24px" }}>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: C.text, margin: 0, marginBottom: "4px" }}>
            {mode === "view" && selected ? selected.name : "Nueva simulación"}
          </h1>
          {mode === "view" && selected && (
            <div style={{ fontSize: "12px", color: C.textMuted }}>
              {[
                selected.input.objective && `Objetivo: ${selected.input.objective}`,
                selected.input.industry && `Industria: ${selected.input.industry}`,
                `Canales: ${selected.input.channels.join(", ")}`,
              ].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>

        {/* ── Form ── */}
        {mode === "new" && !simResult && !simLoading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={card()}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: C.text, marginBottom: "14px" }}>
                Contenido de la secuencia
              </div>

              {/* Drop zone */}
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                style={{
                  border: "2px dashed " + C.borderMd, borderRadius: "8px",
                  padding: "20px", textAlign: "center", cursor: "pointer",
                  background: C.pageBg, marginBottom: "14px",
                }}
              >
                {sequencePdf ? (
                  <div>
                    <div style={{ fontSize: "24px", marginBottom: "6px" }}>📄</div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{sequencePdf.name}</div>
                    <div style={{ fontSize: "11px", color: C.textFaint, marginTop: "4px" }}>PDF cargado · click para cambiar</div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: "24px", marginBottom: "6px" }}>☁</div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: C.textMd }}>
                      Arrastra un archivo aquí o haz click para subir
                    </div>
                    <div style={{ fontSize: "11px", color: C.textFaint, marginTop: "4px" }}>
                      PDF · TXT · Para Word o Google Docs, exporta como PDF
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={fileRef} type="file" accept=".pdf,.txt,.md"
                style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />

              {!sequencePdf && (
                <>
                  <label style={{ ...LBL, display: "block", marginBottom: "6px" }}>
                    O pega el texto directamente
                  </label>
                  <textarea
                    value={sequenceText}
                    onChange={e => setSequenceText(e.target.value)}
                    placeholder="Pega aquí el contenido de tus mensajes, scripts de LinkedIn, secuencias de email, etc..."
                    style={{ ...INP, height: "200px", resize: "vertical", fontFamily: FF }}
                  />
                </>
              )}
            </div>

            <div style={card()}>
              <div style={{ fontSize: "13px", fontWeight: 700, color: C.text, marginBottom: "14px" }}>
                Parámetros de la simulación
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                <div>
                  <label style={LBL}>Objetivo</label>
                  <input value={objective} onChange={e => setObjective(e.target.value)}
                    placeholder="ej. agendar demo..." style={INP} />
                </div>
                <div>
                  <label style={LBL}>Industria objetivo</label>
                  <input value={industry} onChange={e => setIndustry(e.target.value)}
                    placeholder="ej. SaaS, Retail..." style={INP} />
                </div>
                <div>
                  <label style={LBL}>Cargo objetivo</label>
                  <input value={role} onChange={e => setRole(e.target.value)}
                    placeholder="ej. CMO, VP Ventas..." style={INP} />
                </div>
              </div>
              <div>
                <label style={LBL}>Canales de la secuencia</label>
                <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                  {["linkedin", "email", "whatsapp"].map(ch => (
                    <label key={ch} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px", color: C.textMd }}>
                      <input type="checkbox" checked={channels.includes(ch)} onChange={() => toggleChannel(ch)}
                        style={{ width: "15px", height: "15px", accentColor: C.accent }} />
                      {ch.charAt(0).toUpperCase() + ch.slice(1)}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {simErr && (
              <div style={{ background: "#FFF5F5", border: "1px solid #FACCCC", borderRadius: "8px", padding: "12px 14px", fontSize: "12px", color: "#C0392B" }}>
                {simErr}
              </div>
            )}

            <div>
              <Btn v="primary" onClick={handleSimulate}
                disabled={(!sequenceText.trim() && !sequencePdf) || channels.length === 0}>
                Iniciar simulación
              </Btn>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {simLoading && (
          <div style={card({ textAlign: "center", padding: "80px 40px" })}>
            <div style={{ fontSize: "40px", marginBottom: "14px" }}>🧠</div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: C.textMd, marginBottom: "6px" }}>
              Simulando audiencia virtual...
            </div>
            <div style={{ fontSize: "12px", color: C.textFaint }}>
              Analizando la secuencia y calculando métricas de apertura, respuesta e interés
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {resultToShow && !simLoading && (
          <div>
            {canSave && (
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px", alignItems: "center", flexWrap: "wrap" }}>
                <Btn v="success" onClick={handleSave}>Guardar simulación</Btn>
                <Btn v="ghost" onClick={() => setSimResult(null)}>↩ Editar parámetros</Btn>
                <Btn v="outline" onClick={startNew}>Nueva simulación</Btn>
              </div>
            )}
            {mode === "view" && (
              <div style={{ marginBottom: "20px" }}>
                <Btn v="outline" onClick={startNew}>+ Nueva simulación</Btn>
              </div>
            )}

            {/* KPI cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "20px" }}>
              {[
                { label: "Tasa de Apertura", value: resultToShow.open_rate + "%", color: C.accent, sub: "de la audiencia virtual" },
                { label: "Tasa de Respuesta", value: resultToShow.response_rate + "%", color: C.success, sub: "probabilidad de respuesta" },
                { label: "Interés Generado", value: resultToShow.interest_score + "%", color: C.purple, sub: null },
              ].map(({ label, value, color, sub }) => (
                <div key={label} style={card({ textAlign: "center", padding: "24px 20px" })}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "40px", fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                  {sub
                    ? <div style={{ fontSize: "11px", color: C.textFaint, marginTop: "6px" }}>{sub}</div>
                    : (
                      <div style={{ marginTop: "8px" }}>
                        <Badge color={resultToShow.interest_level === "alto" ? "green" : resultToShow.interest_level === "medio" ? "amber" : "gray"}>
                          {resultToShow.interest_level.charAt(0).toUpperCase() + resultToShow.interest_level.slice(1)}
                        </Badge>
                      </div>
                    )
                  }
                </div>
              ))}
            </div>

            {/* Reactions */}
            {resultToShow.reactions.length > 0 && (
              <div style={card({ marginBottom: "16px", padding: 0, overflow: "hidden" })}>
                <div style={{ padding: "14px 18px", borderBottom: "1px solid " + C.border, background: C.pageBg }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>Reacciones del público virtual</div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>{["Perfil", "Canal", "Abre", "Responde", "Interés", "Comentario"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {resultToShow.reactions.map((r, i) => (
                      <tr key={i}>
                        <td style={TD}>{r.contact_name}</td>
                        <td style={TD}>
                          <Badge color={r.channel === "linkedin" ? "blue" : r.channel === "email" ? "amber" : "green"}>{r.channel}</Badge>
                        </td>
                        <td style={TD}>{r.opens ? "✅" : "❌"}</td>
                        <td style={TD}>{r.responds ? "✅" : "❌"}</td>
                        <td style={TD}>
                          <Badge color={r.interest === "alto" ? "green" : r.interest === "medio" ? "amber" : "gray"}>{r.interest}</Badge>
                        </td>
                        <td style={{ ...TD, color: C.textMuted, fontStyle: "italic", fontSize: "11px" }}>{r.comment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Insights */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px" }}>
              <div style={card({ borderTop: "3px solid " + C.success })}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: C.success, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" }}>Puntos Fuertes</div>
                {(resultToShow.insights.strengths || []).map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "10px", fontSize: "12px", color: C.textMd, lineHeight: 1.5 }}>
                    <span style={{ color: C.success, fontWeight: 800, flexShrink: 0 }}>✓</span>{s}
                  </div>
                ))}
              </div>
              <div style={card({ borderTop: "3px solid #C0392B" })}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#C0392B", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" }}>Debilidades</div>
                {(resultToShow.insights.weaknesses || []).map((w, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "10px", fontSize: "12px", color: C.textMd, lineHeight: 1.5 }}>
                    <span style={{ color: "#C0392B", fontWeight: 800, flexShrink: 0 }}>✗</span>{w}
                  </div>
                ))}
              </div>
              <div style={card({ borderTop: "3px solid " + C.info })}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: C.info, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" }}>Sugerencias</div>
                {(resultToShow.insights.suggestions || []).map((sg, i) => (
                  <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "10px", fontSize: "12px", color: C.textMd, lineHeight: 1.5 }}>
                    <span style={{ color: C.info, fontWeight: 800, flexShrink: 0 }}>{i + 1}.</span>{sg}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
