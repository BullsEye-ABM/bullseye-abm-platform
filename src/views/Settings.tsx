import { card, Btn } from "../components/ui";
import { C } from "../lib/utils";

export function SettingsView() {
  return (
    <div>
      <div style={{ marginBottom: "28px" }}>
        <div style={{ fontSize: "22px", fontWeight: 700, color: C.text }}>Configuración</div>
        <div style={{ fontSize: "14px", color: C.textMuted }}>Información de la plataforma</div>
      </div>
      <div style={card({ marginBottom: "16px" })}>
        <div style={{ fontWeight: 700, fontSize: "15px", color: C.text, marginBottom: "6px" }}>Estado de la conexión</div>
        <div style={{ fontSize: "13px", color: C.textMuted, marginBottom: "14px" }}>
          BullsEye comparte la base de datos Supabase con prospector-app.
        </div>
        <div style={{ display: "grid", gap: "8px", fontSize: "13px" }}>
          <div>📦 Backend: Vercel serverless (proxies a Anthropic + Lemlist)</div>
          <div>🔐 Lemlist API keys: encriptadas AES-256 por cliente</div>
          <div>🤖 Modelo IA: Claude Sonnet 4 (server-side)</div>
        </div>
      </div>
      <div style={card()}>
        <div style={{ fontWeight: 700, fontSize: "15px", color: C.text, marginBottom: "6px" }}>Integración con prospector-app</div>
        <div style={{ fontSize: "13px", color: C.textMuted, marginBottom: "14px" }}>
          El botón "📤 Enviar a BullsEye" del prospector creará automáticamente segmentos con los contactos finales.
        </div>
        <Btn v="ghost" onClick={() => window.open("https://github.com/BullsEye-ABM/prospector-app", "_blank")}>
          Abrir prospector-app →
        </Btn>
      </div>
    </div>
  );
}
