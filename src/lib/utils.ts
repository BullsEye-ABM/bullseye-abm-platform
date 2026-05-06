// Utilidades compartidas

export const uid = () => Math.random().toString(36).slice(2, 9);

// Paleta original de Jaime (constantes para inline styles que aún quedan en algunas partes)
export const C = {
  pageBg: "#F6F6F4",
  white: "#FFFFFF",
  border: "#E9E9E6",
  borderMd: "#D8D8D4",
  accent: "#251762",
  accentBg: "#EEEAF8",
  text: "#1C1C1A",
  textMd: "#4A4A47",
  textMuted: "#8A8A85",
  textFaint: "#C0C0BB",
  success: "#16A369",
  successBg: "#EDFAF3",
  info: "#2060D8",
  infoBg: "#EEF3FD",
  warn: "#B8720A",
  warnBg: "#FEF4E2",
  purple: "#7B3FD4",
  purpleBg: "#F4EFFE",
  shadow: "0 1px 3px rgba(0,0,0,0.07)",
  shadowMd: "0 4px 16px rgba(0,0,0,0.09)",
} as const;

export const FF = "'Inter','Helvetica Neue',Arial,sans-serif";

// CSV
export interface RawCSVData {
  headers: string[];
  rows: string[][];
}

export function parseCSV(text: string): RawCSVData {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const rows = lines
    .slice(1)
    .filter(l => l.trim())
    .map(line => line.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
  return { headers, rows };
}

export const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  title: "Cargo",
  company: "Empresa",
  email: "Email",
  country: "País",
  decision_maker: "Tomador de decisión",
  linkedin: "LinkedIn",
  website: "Web empresa",
  phone: "Teléfono",
};

export function applyColumnMap(
  rawData: RawCSVData,
  colMap: Record<string, number | "" | null | undefined>,
) {
  return rawData.rows
    .map(cols => {
      const obj: Record<string, string> = {};
      Object.entries(colMap).forEach(([field, colIdx]) => {
        if (colIdx !== "" && colIdx !== null && colIdx !== undefined) {
          obj[field] = cols[colIdx as number] || "";
        }
      });
      return obj;
    })
    .filter(obj => obj.name || obj.email);
}

export const readText = (f: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res((e.target?.result as string) || "");
    r.onerror = rej;
    r.readAsText(f);
  });

export const readBase64 = (f: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = e => res(((e.target?.result as string) || "").split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
