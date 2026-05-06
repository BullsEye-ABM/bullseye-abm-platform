// Componentes UI core (estilos heredados del Artifact original de Jaime)
// Mantenemos inline styles para preservar fidelidad pixel-perfect.

import { type ReactNode, type CSSProperties, useState } from "react";
import { C, FF } from "../lib/utils";

// ─── Helper styles ────────────────────────────────────────────────────────────
export const card = (extra?: CSSProperties): CSSProperties => ({
  background: C.white,
  border: "1px solid " + C.border,
  borderRadius: "12px",
  padding: "20px",
  boxShadow: C.shadow,
  ...extra,
});

export const kpi = (): CSSProperties => ({
  background: C.white,
  border: "1px solid " + C.border,
  borderRadius: "10px",
  padding: "18px 20px",
  boxShadow: C.shadow,
});

export const TH: CSSProperties = {
  textAlign: "left",
  padding: "9px 14px",
  fontSize: "11px",
  fontWeight: 600,
  color: C.textMuted,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  borderBottom: "1px solid " + C.border,
  background: C.pageBg,
};

export const TD: CSSProperties = {
  padding: "11px 14px",
  borderBottom: "1px solid " + C.border,
  verticalAlign: "middle",
  fontSize: "13px",
  color: C.text,
};

export const INP: CSSProperties = {
  background: C.white,
  border: "1.5px solid " + C.border,
  borderRadius: "8px",
  color: C.text,
  padding: "9px 12px",
  fontSize: "13px",
  width: "100%",
  fontFamily: FF,
  boxSizing: "border-box",
  outline: "none",
};

export const LBL: CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: C.textMd,
  marginBottom: "6px",
  display: "block",
};

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "success" | "purple" | "outline" | "ghost" | "sm" | "danger" | "warn";

interface BtnProps {
  v?: BtnVariant;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  children: ReactNode;
  style?: CSSProperties;
  type?: "button" | "submit";
}

export function Btn({ v = "primary", onClick, disabled, children, style, type = "button" }: BtnProps) {
  const base: CSSProperties = {
    border: "none",
    borderRadius: "8px",
    padding: "9px 18px",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: "13px",
    fontWeight: 600,
    fontFamily: FF,
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    opacity: disabled ? 0.6 : 1,
    whiteSpace: "nowrap",
  };
  const vs: Record<BtnVariant, CSSProperties> = {
    primary: { background: C.accent, color: "#fff" },
    success: { background: C.success, color: "#fff" },
    purple:  { background: C.purple,  color: "#fff" },
    outline: { background: C.white, color: C.accent, border: "1.5px solid " + C.accent },
    ghost:   { background: "transparent", color: C.textMuted, border: "1px solid " + C.border, padding: "6px 12px", fontSize: "12px" },
    sm:      { background: C.accent, color: "#fff", padding: "5px 12px", fontSize: "12px", borderRadius: "6px" },
    danger:  { background: "#FFF5F5", color: "#C0392B", border: "1px solid #FACCCC", padding: "5px 10px", fontSize: "11px" },
    warn:    { background: C.warnBg, color: C.warn, border: "1px solid " + C.warn },
  };
  return (
    <button type={type} style={{ ...base, ...vs[v], ...style }} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
type BadgeColor = "green" | "red" | "blue" | "amber" | "gray" | "purple";

export function Badge({ color, children }: { color: BadgeColor; children: ReactNode }) {
  const m: Record<BadgeColor, [string, string]> = {
    green:  [C.success, C.successBg],
    red:    ["#C0392B", "#FFF5F5"],
    blue:   [C.info, C.infoBg],
    amber:  [C.warn, C.warnBg],
    gray:   [C.textMuted, C.pageBg],
    purple: [C.purple, C.purpleBg],
  };
  const [c, bg] = m[color] || m.gray;
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: "20px",
      fontSize: "11px", fontWeight: 600, background: bg, color: c, whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  const map: Record<string, BadgeColor> = { active: "green", draft: "amber", paused: "blue" };
  return <Badge color={map[status || ""] || "gray"}>{status || "draft"}</Badge>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface ModalProps {
  title: string;
  onClose?: () => void;
  children: ReactNode;
  width?: string;
}

export function Modal({ title, onClose, children, width }: ModalProps) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      backdropFilter: "blur(3px)",
    }}>
      <div style={{
        background: C.white, border: "1px solid " + C.border, borderRadius: "16px",
        width: width || "500px", maxWidth: "92vw", padding: "28px 32px",
        boxShadow: C.shadowMd, maxHeight: "88vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: C.text }}>{title}</div>
          {onClose && (
            <button onClick={onClose} style={{
              background: C.pageBg, border: "none", color: C.textMuted, cursor: "pointer",
              width: "30px", height: "30px", borderRadius: "50%", fontSize: "16px", fontFamily: FF,
            }}>×</button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}

export function Field({ label, value, onChange, type, placeholder, hint }: FieldProps) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <label style={LBL}>{label}</label>
      <input
        style={INP}
        type={type || "text"}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || ""}
      />
      {hint && <div style={{ fontSize: "11px", color: C.textFaint, marginTop: "4px" }}>{hint}</div>}
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
export function SLbl({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{
      fontSize: "11px", fontWeight: 700, color: C.textMuted,
      letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "14px",
      ...style,
    }}>{children}</div>
  );
}

// ─── ChannelConfig ────────────────────────────────────────────────────────────
import type { Channel } from "../types/db";

interface ChannelConfigProps {
  channels: Channel[];
  msgsPerChannel: Record<Channel, number>;
  onChangeChannels: (chs: Channel[]) => void;
  onChangeMsgs: (m: Record<Channel, number>) => void;
}

export function ChannelConfig({ channels, msgsPerChannel, onChangeChannels, onChangeMsgs }: ChannelConfigProps) {
  const toggle = (ch: Channel) =>
    onChangeChannels(channels.includes(ch) ? channels.filter(c => c !== ch) : [...channels, ch]);

  const items: [Channel, string][] = [
    ["linkedin", "LinkedIn"],
    ["email", "Email"],
    ["whatsapp", "WhatsApp"],
  ];

  return (
    <div style={{
      background: C.pageBg, border: "1px solid " + C.border, borderRadius: "10px",
      padding: "14px", display: "flex", flexDirection: "column", gap: "12px",
    }}>
      {items.map(([ch, lbl]) => (
        <div key={ch} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", minWidth: "110px" }}>
            <input
              type="checkbox"
              checked={channels.includes(ch)}
              onChange={() => toggle(ch)}
              style={{ accentColor: C.accent, width: "15px", height: "15px" }}
            />
            <span style={{
              fontSize: "13px",
              fontWeight: channels.includes(ch) ? 600 : 400,
              color: channels.includes(ch) ? C.text : C.textMuted,
            }}>{lbl}</span>
          </label>
          {channels.includes(ch) && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: C.textMuted }}>Mensajes:</span>
              <input
                type="number"
                min={1}
                max={5}
                value={msgsPerChannel[ch] || 1}
                onChange={e =>
                  onChangeMsgs({ ...msgsPerChannel, [ch]: parseInt(e.target.value) || 1 })
                }
                style={{ ...INP, width: "60px", textAlign: "center" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── GenIndicator (toaster de jobs activos) ───────────────────────────────────
import { useEffect } from "react";
import { GenService } from "../lib/genService";

export function GenIndicator() {
  const [jobs, setJobs] = useState(GenService.getJobs());
  useEffect(() => {
    const unsub = GenService.subscribe(setJobs);
    return () => { unsub(); };
  }, []);
  const list = [...jobs.values()];
  if (!list.length) return null;
  return (
    <div style={{
      position: "fixed", bottom: "20px", right: "20px", zIndex: 2000,
      display: "flex", flexDirection: "column", gap: "8px",
    }}>
      {list.map(j => (
        <div key={j.segId} style={{
          background: C.accent, color: "#fff", borderRadius: "12px", padding: "12px 16px",
          boxShadow: C.shadowMd, minWidth: "260px", fontFamily: FF,
        }}>
          <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "8px",
            display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>⚙ Generando · {j.label}</span>
            <button onClick={() => GenService.cancel(j.segId)} style={{
              background: "rgba(255,255,255,0.2)", border: "none", color: "#fff",
              borderRadius: "6px", padding: "2px 8px", cursor: "pointer", fontSize: "11px", fontFamily: FF,
            }}>Cancelar</button>
          </div>
          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: "6px", height: "5px", overflow: "hidden" }}>
            <div style={{
              width: (j.current / j.total * 100) + "%",
              height: "100%", background: "#fff", borderRadius: "6px", transition: "width 0.3s",
            }} />
          </div>
          <div style={{ fontSize: "11px", marginTop: "5px", opacity: 0.8 }}>
            {j.current} / {j.total} contactos
          </div>
        </div>
      ))}
    </div>
  );
}
