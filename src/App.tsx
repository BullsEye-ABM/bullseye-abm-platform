import { useEffect, useRef, useState } from "react";
import { Dashboard } from "./views/Dashboard";
import { ClientsView } from "./views/Clients";
import { CampaignView } from "./views/Campaign";
import { SettingsView } from "./views/Settings";
import { SimulatorModule } from "./views/SimulatorModule";
import { GenIndicator } from "./components/ui";
import { C, FF } from "./lib/utils";
import { clientsRepo, campaignsRepo } from "./lib/db";
import type { Client, BullseyeCampaign } from "./types/db";

type Page = "dashboard" | "clients" | "campaign" | "simulator" | "settings";

// ─── Quick-nav palette ──────────────────────────────────────────────────────────────────────────────
function QuickNavPalette({
  clients,
  campaigns,
  onSelect,
  onClose,
}: {
  clients: Client[];
  campaigns: BullseyeCampaign[];
  onSelect: (campaignId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<"clients" | "campaigns">("clients");
  const [pickedClient, setPickedClient] = useState<Client | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (step === "campaigns") { setStep("clients"); setPickedClient(null); setQuery(""); }
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, onClose]);

  const q = query.toLowerCase().trim();

  const searchResults = q
    ? campaigns.filter(c => {
        const cl = clients.find(cl => cl.id === c.client_id);
        return c.name.toLowerCase().includes(q) || (cl?.name || "").toLowerCase().includes(q);
      })
    : [];

  const clientList = q
    ? clients.filter(cl => cl.name.toLowerCase().includes(q))
    : clients;

  const campaignList = pickedClient
    ? campaigns.filter(c => c.client_id === pickedClient.id)
    : [];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(15,10,40,0.45)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "80px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "480px", background: C.white, borderRadius: "14px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.22)",
          overflow: "hidden", fontFamily: FF,
        }}
      >
        {/* Header */}
        <div style={{ padding: "14px 16px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", gap: "10px" }}>
          {step === "campaigns" && pickedClient && (
            <button
              onClick={() => { setStep("clients"); setPickedClient(null); setQuery(""); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, fontSize: "16px", padding: "0 4px", lineHeight: 1 }}
            >←</button>
          )}
          <span style={{ fontSize: "14px" }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={
              step === "campaigns" && pickedClient
                ? `Buscar campaña en ${pickedClient.name}...`
                : "Buscar cliente o campaña..."
            }
            style={{
              flex: 1, border: "none", outline: "none", fontSize: "14px",
              color: C.text, background: "transparent", fontFamily: FF,
            }}
          />
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.textFaint, fontSize: "16px", lineHeight: 1 }}>✕</button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: "380px", overflowY: "auto", padding: "8px" }}>

          {/* Search mode: flat results */}
          {q && step === "clients" && (
            <>
              {searchResults.length === 0 && clientList.length === 0 && (
                <div style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: C.textFaint }}>
                  Sin resultados para "{query}"
                </div>
              )}
              {searchResults.map(c => {
                const cl = clients.find(cl => cl.id === c.client_id);
                return (
                  <HoverRow key={c.id} onClick={() => { onSelect(c.id); onClose(); }}>
                    <div style={{ fontSize: "13px", flex: 1 }}>
                      <span style={{ color: C.textMuted, marginRight: "6px", fontSize: "11px" }}>{cl?.name}</span>
                      <span style={{ fontWeight: 500, color: C.text }}>›</span>
                      <span style={{ fontWeight: 600, color: C.text, marginLeft: "6px" }}>{c.name}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: C.textFaint }}>abrir →</span>
                  </HoverRow>
                );
              })}
            </>
          )}

          {/* Step 1: client list */}
          {step === "clients" && !q && (
            <>
              <div style={{ fontSize: "11px", fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 14px 8px" }}>
                Clientes
              </div>
              {clientList.map(cl => {
                const count = campaigns.filter(c => c.client_id === cl.id).length;
                const ini = cl.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <HoverRow key={cl.id} onClick={() => { setPickedClient(cl); setStep("campaigns"); setQuery(""); }}>
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "7px", background: C.accentBg,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: 700, color: C.accent, flexShrink: 0,
                    }}>{ini}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{cl.name}</div>
                      <div style={{ fontSize: "11px", color: C.textFaint }}>{cl.industry || "Sin industria"} · {count} campaña{count !== 1 ? "s" : ""}</div>
                    </div>
                    <span style={{ color: C.textFaint, fontSize: "13px" }}>›</span>
                  </HoverRow>
                );
              })}
              {clientList.length === 0 && (
                <div style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: C.textFaint }}>Sin clientes</div>
              )}
            </>
          )}

          {/* Step 2: campaign list for picked client */}
          {step === "campaigns" && pickedClient && (
            <>
              <div style={{ fontSize: "11px", fontWeight: 700, color: C.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", padding: "4px 14px 8px" }}>
                Campañas · {pickedClient.name}
              </div>
              {campaignList
                .filter(c => !q || c.name.toLowerCase().includes(q))
                .map(c => (
                  <HoverRow key={c.id} onClick={() => { onSelect(c.id); onClose(); }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{c.name}</div>
                      <div style={{ fontSize: "11px", color: C.textFaint }}>
                        {c.industry || ""}{c.role ? ` · ${c.role}` : ""}
                      </div>
                    </div>
                    <span style={{
                      fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "4px",
                      background: c.status === "active" ? C.successBg : C.accentBg,
                      color: c.status === "active" ? C.success : C.accent,
                    }}>{c.status}</span>
                  </HoverRow>
                ))}
              {campaignList.length === 0 && (
                <div style={{ padding: "24px", textAlign: "center", fontSize: "13px", color: C.textFaint }}>Sin campañas</div>
              )}
            </>
          )}
        </div>

        <div style={{ padding: "8px 16px", borderTop: "1px solid " + C.border, fontSize: "11px", color: C.textFaint, display: "flex", gap: "16px" }}>
          <span>↵ abrir</span>
          <span>Esc {step === "campaigns" ? "volver" : "cerrar"}</span>
        </div>
      </div>
    </div>
  );
}

function HoverRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "9px 14px", borderRadius: "7px", cursor: "pointer",
        background: hover ? C.accentBg : "transparent",
      }}
    >
      {children}
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [campaigns, setCampaigns] = useState<BullseyeCampaign[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQuickNav, setShowQuickNav] = useState(false);

  // Atajo de teclado Ctrl+K / Cmd+K para abrir quick-nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowQuickNav(v => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

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
    { k: "dashboard",  l: "Dashboard",    icon: "▦" },
    { k: "clients",    l: "Clientes",     icon: "◉" },
    { k: "simulator",  l: "Simulador",    icon: "⚡" },
    { k: "settings",   l: "Configuración", icon: "⚙" },
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
        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
          <button
            onClick={() => setShowQuickNav(true)}
            style={{
              display: "flex", alignItems: "center", gap: "8px", width: "100%",
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "8px", padding: "8px 12px", cursor: "pointer",
              color: "rgba(255,255,255,0.55)", fontSize: "12px", fontFamily: FF,
            }}
          >
            <span>🔍</span>
            <span style={{ flex: 1, textAlign: "left" }}>Ir a campaña...</span>
            <span style={{ fontSize: "10px", opacity: 0.6, background: "rgba(255,255,255,0.1)", borderRadius: "4px", padding: "1px 5px" }}>⌘K</span>
          </button>
        </div>
        <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "11px", color: "rgba(255,255,255,0.3)" }}>
          v0.1 · {clients.length} clientes
        </div>
      </div>

      {showQuickNav && (
        <QuickNavPalette
          clients={clients}
          campaigns={campaigns}
          onSelect={(id) => { setActiveCampaignId(id); setPage("campaign"); }}
          onClose={() => setShowQuickNav(false)}
        />
      )}

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
        {page === "simulator" && <SimulatorModule />}
        {page === "settings" && <SettingsView />}
      </div>
    </div>
  );
}
