import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { card, kpi, TH, TD, SLbl, StatusBadge, Btn } from "../components/ui";
import { C } from "../lib/utils";
import type { Client, BullseyeCampaign } from "../types/db";

interface Props {
  clients: Client[];
  campaigns: BullseyeCampaign[];
  onNavigate: (page: string) => void;
}

export function Dashboard({ clients, campaigns, onNavigate }: Props) {
  const totalContacts = 0; // se calcula leyendo segmentos si lo quieres exacto; v0.1 lo deja en 0
  const active = campaigns.filter(c => c.status === "active").length;

  const chartData = clients.map(cl => {
    const cc = campaigns.filter(c => c.client_id === cl.id);
    return {
      name: cl.name.length > 12 ? cl.name.slice(0, 11) + "..." : cl.name,
      campañas: cc.length,
      activas: cc.filter(c => c.status === "active").length,
    };
  });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "28px" }}>
        <div>
          <div style={{ fontSize: "22px", fontWeight: 700, color: C.text }}>Dashboard</div>
          <div style={{ fontSize: "14px", color: C.textMuted }}>Resumen global ABM</div>
        </div>
        <div style={{
          background: C.accentBg, border: "1px solid #C5BAE8", borderRadius: "8px",
          padding: "8px 14px", fontSize: "12px", color: C.accent, fontWeight: 600,
        }}>BullsEye ABM Platform</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: "14px", marginBottom: "22px" }}>
        {[
          ["Clientes", clients.length],
          ["Campañas", `${campaigns.length} / ${active} activas`],
          ["Contactos", totalContacts.toLocaleString()],
          ["Mensajes aprobados", "—"],
        ].map(([l, v]) => (
          <div key={l as string} style={kpi()}>
            <div style={{ fontSize: "12px", fontWeight: 500, color: C.textMuted, marginBottom: "10px" }}>{l}</div>
            <div style={{ fontSize: "26px", fontWeight: 700, color: C.text }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px" }}>
        <div style={card()}>
          <SLbl>Campañas por cliente</SLbl>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: -22, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: C.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: C.white, border: "1px solid " + C.border, borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="campañas" fill={C.accent} radius={[4, 4, 0, 0]} />
                <Bar dataKey="activas" fill={C.info} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{
              height: 200, display: "flex", alignItems: "center", justifyContent: "center",
              color: C.textFaint, fontSize: "13px",
            }}>Crea clientes para ver el gráfico</div>
          )}
        </div>

        <div style={card()}>
          <SLbl>Campañas recientes</SLbl>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>{["Campaña", "Estado", "Cliente"].map(h => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {campaigns.slice(0, 6).map(c => {
                const cl = clients.find(x => x.id === c.client_id);
                return (
                  <tr key={c.id}>
                    <td style={TD}><div style={{ fontWeight: 500 }}>{c.name}</div></td>
                    <td style={TD}><StatusBadge status={c.status} /></td>
                    <td style={TD}>{cl ? cl.name : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: "14px" }}>
            <Btn v="sm" onClick={() => onNavigate("clients")}>Ver clientes</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
