import { useEffect, useState } from "react";
import { card, Btn, Badge, Modal, Field, StatusBadge, SLbl, ChannelConfig, INP } from "../components/ui";
import { C } from "../lib/utils";
import { campaignsRepo, segmentsRepo, clientsRepo } from "../lib/db";
import { GenService } from "../lib/genService";
import { SegmentDetail } from "./Segment";
import type { BullseyeCampaign, BullseyeSegment, Client, Channel } from "../types/db";

interface Props {
  campaignId: string;
  onBack: () => void;
}

export function CampaignView({ campaignId, onBack }: Props) {
  const [campaign, setCampaign] = useState<BullseyeCampaign | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [segments, setSegments] = useState<BullseyeSegment[]>([]);
  const [activeSegId, setActiveSegId] = useState<string | null>(null);
  const [showNewSeg, setShowNewSeg] = useState(false);
  const [sf, setSf] = useState({ name: "", criteria: "" });
  const [editCamp, setEditCamp] = useState(false);
  const [campEdit, setCampEdit] = useState<Partial<BullseyeCampaign> | null>(null);

  useEffect(() => {
    (async () => {
      const camp = await campaignsRepo.get(campaignId);
      if (!camp) return;
      setCampaign(camp);
      const [cls, segs] = await Promise.all([
        clientsRepo.list(),
        segmentsRepo.listByCampaign(campaignId),
      ]);
      setClient(cls.find(c => c.id === camp.client_id) || null);
      setSegments(segs);
    })();
  }, [campaignId]);

  const reloadSegments = async () => {
    const segs = await segmentsRepo.listByCampaign(campaignId);
    setSegments(segs);
  };

  const handleCreateSegment = async () => {
    if (!sf.name.trim()) return;
    const created = await segmentsRepo.create({
      campaign_id: campaignId,
      name: sf.name,
      criteria: sf.criteria,
      contact_count: 0,
      approved_count: 0,
    });
    setSf({ name: "", criteria: "" });
    setShowNewSeg(false);
    reloadSegments();
    setActiveSegId(created.id);
  };

  const handleDeleteSegment = async (id: string) => {
    if (!window.confirm("¿Eliminar segmento?")) return;
    await segmentsRepo.remove(id);
    reloadSegments();
  };

  const openEdit = () => {
    if (!campaign) return;
    setCampEdit({
      name: campaign.name,
      goal: campaign.goal,
      industry: campaign.industry,
      role: campaign.role,
      status: campaign.status,
      channels: campaign.channels,
      msgs_per_channel: campaign.msgs_per_channel,
    });
    setEditCamp(true);
  };

  const saveEdit = async () => {
    if (!campaign || !campEdit) return;
    const updated = await campaignsRepo.update(campaign.id, campEdit);
    setCampaign(updated);
    setEditCamp(false);
  };

  if (!campaign) {
    return <div style={{ color: C.textMuted }}>Cargando campaña...</div>;
  }

  if (activeSegId) {
    const seg = segments.find(s => s.id === activeSegId);
    if (!seg) {
      setActiveSegId(null);
      return null;
    }
    return (
      <SegmentDetail
        segmentId={seg.id}
        campaign={campaign}
        client={client}
        onBack={() => { setActiveSegId(null); reloadSegments(); }}
      />
    );
  }

  const totalC = segments.reduce((s, seg) => s + (seg.contact_count || 0), 0);
  const totalA = segments.reduce((s, seg) => s + (seg.approved_count || 0), 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: C.accent, fontSize: "13px" }}>
          ← Clientes
        </button>
        <span style={{ color: C.borderMd }}>/</span>
        {client && <span style={{ fontSize: "13px", color: C.textMuted }}>{client.name}</span>}
        {client && <span style={{ color: C.borderMd }}>/</span>}
        <span style={{ fontSize: "13px", color: C.textMuted }}>{campaign.name}</span>
      </div>

      <div style={card({ marginBottom: "20px" })}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: C.text, marginBottom: "6px" }}>{campaign.name}</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <StatusBadge status={campaign.status} />
              {campaign.industry && <Badge color="blue">{campaign.industry}</Badge>}
              {campaign.role && <Badge color="purple">{campaign.role}</Badge>}
              {(campaign.channels || []).map(ch => <Badge key={ch} color="gray">{ch}</Badge>)}
            </div>
            {campaign.goal && (
              <div style={{ fontSize: "13px", color: C.textMuted, marginTop: "8px" }}>Objetivo: {campaign.goal}</div>
            )}
          </div>
          <Btn v="ghost" onClick={openEdit}>Editar</Btn>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px", marginTop: "16px" }}>
          {[["Segmentos", segments.length], ["Contactos", totalC], ["Aprobados", totalA]].map(([l, v]) => (
            <div key={l as string} style={{ background: C.pageBg, borderRadius: "8px", padding: "12px 16px" }}>
              <div style={{ fontSize: "11px", color: C.textMuted, marginBottom: "4px" }}>{l}</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color: C.text }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <SLbl style={{ marginBottom: 0 }}>Segmentos ({segments.length})</SLbl>
        <Btn v="primary" onClick={() => setShowNewSeg(true)}>+ Nuevo segmento</Btn>
      </div>

      {segments.length === 0 && (
        <div style={card({ textAlign: "center", padding: "40px" })}>
          <div style={{ fontSize: "14px", color: C.textMuted, marginBottom: "16px" }}>
            Sin segmentos — crea el primero para comenzar
          </div>
          <Btn v="primary" onClick={() => setShowNewSeg(true)}>+ Crear segmento</Btn>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {segments.map(seg => {
          const pct = seg.contact_count > 0 ? Math.round((seg.approved_count / seg.contact_count) * 100) : 0;
          return (
            <div key={seg.id} style={card({ padding: 0, overflow: "hidden" })}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 20px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: C.accentBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>📋</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: C.text }}>{seg.name}</div>
                  <div style={{ fontSize: "12px", color: C.textMuted }}>{seg.criteria || "Sin criterios"}</div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "6px", alignItems: "center" }}>
                    <span style={{ fontSize: "12px", color: C.textMuted }}>{seg.contact_count} contactos</span>
                    <span style={{ fontSize: "12px", color: C.success }}>{seg.approved_count} aprobados</span>
                    {seg.contact_count > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <div style={{ width: "60px", height: "4px", background: C.border, borderRadius: "4px", overflow: "hidden" }}>
                          <div style={{ width: pct + "%", height: "100%", background: C.success, borderRadius: "4px" }} />
                        </div>
                        <span style={{ fontSize: "11px", color: C.textMuted }}>{pct}%</span>
                      </div>
                    )}
                    {GenService.isRunning(seg.id) && <Badge color="purple">⚙ Generando</Badge>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <Btn v="sm" onClick={() => setActiveSegId(seg.id)}>Abrir</Btn>
                  <Btn v="danger" onClick={() => handleDeleteSegment(seg.id)}>×</Btn>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showNewSeg && (
        <Modal title="Nuevo segmento" onClose={() => setShowNewSeg(false)}>
          <Field label="Nombre *" value={sf.name} onChange={v => setSf(p => ({ ...p, name: v }))} placeholder="Ej: VPs de Ingeniería" />
          <Field label="Criterios" value={sf.criteria} onChange={v => setSf(p => ({ ...p, criteria: v }))} placeholder="Ej: +200 empleados, SaaS, USA" />
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Btn v="ghost" onClick={() => setShowNewSeg(false)}>Cancelar</Btn>
            <Btn v="primary" onClick={handleCreateSegment}>Crear segmento</Btn>
          </div>
        </Modal>
      )}

      {editCamp && campEdit && (
        <Modal title="Editar campaña" onClose={() => setEditCamp(false)} width="600px">
          <Field label="Nombre *" value={campEdit.name || ""} onChange={v => setCampEdit(p => ({ ...p!, name: v }))} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
            <Field label="Objetivo" value={campEdit.goal || ""} onChange={v => setCampEdit(p => ({ ...p!, goal: v }))} />
            <Field label="Industria" value={campEdit.industry || ""} onChange={v => setCampEdit(p => ({ ...p!, industry: v }))} />
          </div>
          <Field label="Cargo objetivo" value={campEdit.role || ""} onChange={v => setCampEdit(p => ({ ...p!, role: v }))} />
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: C.textMd, marginBottom: "6px", display: "block" }}>Estado</label>
            <select value={campEdit.status || "draft"} onChange={e => setCampEdit(p => ({ ...p!, status: e.target.value as BullseyeCampaign["status"] }))} style={{ ...INP, cursor: "pointer" }}>
              {(["draft", "active", "paused"] as const).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: C.textMd, marginBottom: "6px", display: "block" }}>Canales</label>
            <ChannelConfig
              channels={(campEdit.channels || []) as Channel[]}
              msgsPerChannel={campEdit.msgs_per_channel || { linkedin: 1, email: 1, whatsapp: 1 }}
              onChangeChannels={chs => setCampEdit(p => ({ ...p!, channels: chs }))}
              onChangeMsgs={m => setCampEdit(p => ({ ...p!, msgs_per_channel: m }))}
            />
          </div>
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
            <Btn v="ghost" onClick={() => setEditCamp(false)}>Cancelar</Btn>
            <Btn v="primary" onClick={saveEdit}>Guardar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
