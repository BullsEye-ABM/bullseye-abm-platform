// Tipos que reflejan el schema de Supabase (BullsEye ABM Platform)
// Las tablas con prefijo bullseye_ son nuevas; clients/app_users son compartidas con prospector-app

export type Channel = "linkedin" | "email" | "whatsapp";
export type CampaignStatus = "draft" | "active" | "paused";

// Tabla compartida con prospector-app (no la creamos, la reusamos)
export interface Client {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  contact?: string;
  // BullsEye agrega estos campos a la tabla:
  bullseye_lemlist_api_key_encrypted?: string | null;
  created_at: string;
}

export interface BullseyeCampaign {
  id: string;
  client_id: string;
  name: string;
  goal?: string;
  industry?: string;
  role?: string;
  channels: Channel[];
  msgs_per_channel: Record<Channel, number>;
  status: CampaignStatus;
  created_at: string;
}

export interface BullseyeSegment {
  id: string;
  campaign_id: string;
  name: string;
  criteria?: string;
  contact_count: number;
  approved_count: number;
  // Optional link to prospector-app
  prospector_run_id?: string | null;
  created_at: string;
}

export interface BullseyeContact {
  id: string;
  segment_id: string;
  name?: string;
  title?: string;
  company?: string;
  email?: string;
  country?: string;
  decision_maker?: string;
  linkedin?: string;
  website?: string;
  phone?: string;
  // FK opcional al contacto del prospector-app
  prospector_contact_id?: string | null;
  extra?: Record<string, unknown>;
  created_at: string;
}

export interface BullseyeMessage {
  id: string;
  contact_id: string;
  segment_id: string;
  approved: boolean;
  linkedin: string[];
  email: { subject: string; body: string }[];
  whatsapp: string[];
  sources: { query: string; url: string }[];
  generated_at?: string;
  created_at: string;
}

export interface BullseyePersona {
  id: string;
  segment_id: string;
  name: string;
  title: string;
  summary: string;
  pains: string[];
  motivations: string[];
  objections: string[];
  kpis: string[];
  channels: string[];
  created_at: string;
}

export interface BullseyeDirectives {
  id: string;
  segment_id: string;
  text: string;
  updated_at: string;
}

export type SourceType = "url" | "pdf" | "text";
export interface BullseyeSource {
  id: string;
  client_id: string;
  type: SourceType;
  name: string;
  url?: string;
  content?: string; // texto plano
  storage_path?: string; // para PDFs en Supabase Storage
  size?: number;
  created_at: string;
}
