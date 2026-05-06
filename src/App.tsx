import { useEffect, useState } from "react";
import { Dashboard } from "./views/Dashboard";
import { ClientsView } from "./views/Clients";
import { CampaignView } from "./views/Campaign";
import { SettingsView } from "./views/Settings";
import { GenIndicator } from "./components/ui";
import { C, FF } from "./lib/utils";
import { clientsRepo, campaignsRepo } from "./lib/db";
import type { Client, BullseyeCampaign } from "./types/db";

type Page = "dashboard" | "clients" | "campaign" | "settings";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<BullseyeCampaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detectar deep-link desde el prospector: ?campaign=<uuid>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const campId = params.get("campaign");
    if (campId) {
      setActiveCampaignId(campId);
      setPage("campaign");
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [cls, camps] = await Promise.all([clientsRepo.list(), campaignsRepo.listAll()]);
        setClients(cls);
        setCampaigns(camps);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setLoaded(true);
    })();
  }, [page]);

  const nav: { k: Page; l: string; icon: string }[] = [
    { k: "dashboard", l: "Dashboard", icon: "▦" },
    { k: "clients",   l: "Clientes",  icon: "◉" },
    { k: "settings",  l: "Configuración", icon: "⚙" },
  ];

  if (!loaded) {
    return (
      <div style={{ fontFamily: FF, background: C.pageBg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🎯</div>
          <div style={{ fontSize: "15px", fontWeight: 600, color: C.textMd }}>Cargando BullsEye...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontFamily: FF, background: C.pageBg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
        <div style={{ maxWidth: "500px", background: "#FFF5F5", border: "1px solid #FACCCC", borderRadius: "12px", padding: "24px" }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#C0392B", marginBottom: "8px" }}>⚠ Error de conexión</div>
          <div style={{ fontSize: "13px", color: "#8A0000", marginBottom: "12px", fontFamily: "monospace" }}>{error}</div>
          <div style={{ fontSize: "12px", color: C.textMd }}>
            Verifica que la migración SQL haya corrido y que las RLS policies permitan acceso.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: FF, background: C.pageBg, minHeight: "100vh", display: "flex" }}>
      <GenIndicator />

      {/* Sidebar */}
      <div style={{
        width: "220px", background: C.accent, display: "flex", flexDirection: "column",
        flexShrink: 0, position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 10,
      }}>
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontSize: "18px", fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>🎯 BullsEye</div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.5)", marginTop: "2px" }}>ABM Platform</div>
        </div>
        <nav style={{ flex: 1, padding: "12px 0" }}>
          {nav.map(({ k, l, icon }) => {
            const isActive = page === k || (k === "clients" && page === "campaign");
            return (
              <button key={k} onClick={() => { setPage(k); if (k !== "campaign") setActiveCampaignId(null); }} style={{
                display: "flex", alignItems: "center", gap: "10px", width: "100%", border: "none",
                background: isActive ? "rgba(255,255,255,0.15)" : "transparent",
                color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                padding: "10px 20px", fontSize: "13px",
                fontWeight: isActive ? 600 : 400, cursor: "pointer",
                fontFamily: FF, textAlign: "left",
                borderLeft: "3px solid " + (isActive ? "#fff" : "transparent"),
              }}>
                <span style={{ fontSize: "14px" }}>{icon}</span>{l}
              </button>
            );
          })}
        </nav>
        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
          v0.1 · {clients.length} clientes
        </div>
      </div>

      {/* Main */}
      <div style={{ marginLeft: "220px", flex: 1, padding: "32px", maxWidth: "1100px" }}>
        {page === "dashboard" && (
          <Dashboard
            clients={clients}
            campaigns={campaigns}
            onNavigate={(p) => setPage(p as Page)}
          />
        )}
        {page === "clients" && (
          <ClientsView
            onSelectCampaign={(id) => { setActiveCampaignId(id); setPage("campaign"); }}
          />
        )}
        {page === "campaign" && activeCampaignId && (
          <CampaignView
            campaignId={activeCampaignId}
            onBack={() => setPage("clients")}
          />
        )}
        {page === "settings" && <SettingsView />}
      </div>
    </div>
  );
}
