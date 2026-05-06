// Data layer: reemplaza window.storage del código original con Supabase
// Toda la lógica de persistencia vive aquí; los views no tocan supabase directamente.

import { supabase } from "./supabase";
import type {
  Client,
  BullseyeCampaign,
  BullseyeSegment,
  BullseyeContact,
  BullseyeMessage,
  BullseyePersona,
  BullseyeDirectives,
  BullseyeSource,
} from "../types/db";

// ─── Clients ──────────────────────────────────────────────────────────────────
export const clientsRepo = {
  async list(): Promise<Client[]> {
    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .order("name");
    if (error) throw error;
    return (data || []) as Client[];
  },

  async create(input: Partial<Client>): Promise<Client> {
    const { data, error } = await supabase
      .from("clients")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as Client;
  },

  async update(id: string, patch: Partial<Client>): Promise<Client> {
    const { data, error } = await supabase
      .from("clients")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Client;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) throw error;
  },
};

// ─── Campaigns ────────────────────────────────────────────────────────────────
export const campaignsRepo = {
  async listByClient(clientId: string): Promise<BullseyeCampaign[]> {
    const { data, error } = await supabase
      .from("bullseye_campaigns")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as BullseyeCampaign[];
  },

  async listAll(): Promise<BullseyeCampaign[]> {
    const { data, error } = await supabase
      .from("bullseye_campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as BullseyeCampaign[];
  },

  async get(id: string): Promise<BullseyeCampaign | null> {
    const { data, error } = await supabase
      .from("bullseye_campaigns")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as BullseyeCampaign | null;
  },

  async create(input: Partial<BullseyeCampaign>): Promise<BullseyeCampaign> {
    const { data, error } = await supabase
      .from("bullseye_campaigns")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as BullseyeCampaign;
  },

  async update(id: string, patch: Partial<BullseyeCampaign>): Promise<BullseyeCampaign> {
    const { data, error } = await supabase
      .from("bullseye_campaigns")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as BullseyeCampaign;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("bullseye_campaigns").delete().eq("id", id);
    if (error) throw error;
  },
};

// ─── Segments ─────────────────────────────────────────────────────────────────
export const segmentsRepo = {
  async listByCampaign(campaignId: string): Promise<BullseyeSegment[]> {
    const { data, error } = await supabase
      .from("bullseye_segments")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as BullseyeSegment[];
  },

  async get(id: string): Promise<BullseyeSegment | null> {
    const { data, error } = await supabase
      .from("bullseye_segments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data as BullseyeSegment | null;
  },

  async create(input: Partial<BullseyeSegment>): Promise<BullseyeSegment> {
    const { data, error } = await supabase
      .from("bullseye_segments")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as BullseyeSegment;
  },

  async update(id: string, patch: Partial<BullseyeSegment>): Promise<BullseyeSegment> {
    const { data, error } = await supabase
      .from("bullseye_segments")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as BullseyeSegment;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("bullseye_segments").delete().eq("id", id);
    if (error) throw error;
  },

  async refreshCounts(id: string): Promise<void> {
    const [{ count: contactCount }, { count: approvedCount }] = await Promise.all([
      supabase
        .from("bullseye_contacts")
        .select("id", { count: "exact", head: true })
        .eq("segment_id", id),
      supabase
        .from("bullseye_messages")
        .select("id", { count: "exact", head: true })
        .eq("segment_id", id)
        .eq("approved", true),
    ]);
    await supabase
      .from("bullseye_segments")
      .update({
        contact_count: contactCount ?? 0,
        approved_count: approvedCount ?? 0,
      })
      .eq("id", id);
  },
};

// ─── Contacts ─────────────────────────────────────────────────────────────────
export const contactsRepo = {
  async listBySegment(segmentId: string): Promise<BullseyeContact[]> {
    const { data, error } = await supabase
      .from("bullseye_contacts")
      .select("*")
      .eq("segment_id", segmentId)
      .order("created_at");
    if (error) throw error;
    return (data || []) as BullseyeContact[];
  },

  async bulkInsert(segmentId: string, contacts: Partial<BullseyeContact>[]): Promise<BullseyeContact[]> {
    if (contacts.length === 0) return [];
    const rows = contacts.map(c => ({ ...c, segment_id: segmentId }));
    const { data, error } = await supabase
      .from("bullseye_contacts")
      .insert(rows)
      .select();
    if (error) throw error;
    return (data || []) as BullseyeContact[];
  },

  async clearSegment(segmentId: string): Promise<void> {
    const { error } = await supabase
      .from("bullseye_contacts")
      .delete()
      .eq("segment_id", segmentId);
    if (error) throw error;
  },
};

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messagesRepo = {
  async listBySegment(segmentId: string): Promise<BullseyeMessage[]> {
    const { data, error } = await supabase
      .from("bullseye_messages")
      .select("*")
      .eq("segment_id", segmentId)
      .order("created_at");
    if (error) throw error;
    return (data || []) as BullseyeMessage[];
  },

  async upsert(input: Partial<BullseyeMessage> & { contact_id: string; segment_id: string }): Promise<BullseyeMessage> {
    const { data, error } = await supabase
      .from("bullseye_messages")
      .upsert(input, { onConflict: "contact_id" })
      .select()
      .single();
    if (error) throw error;
    return data as BullseyeMessage;
  },

  async update(id: string, patch: Partial<BullseyeMessage>): Promise<BullseyeMessage> {
    const { data, error } = await supabase
      .from("bullseye_messages")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as BullseyeMessage;
  },

  async setAllApproved(segmentId: string, approved: boolean): Promise<void> {
    const { error } = await supabase
      .from("bullseye_messages")
      .update({ approved })
      .eq("segment_id", segmentId);
    if (error) throw error;
  },
};

// ─── Personas ─────────────────────────────────────────────────────────────────
export const personasRepo = {
  async getBySegment(segmentId: string): Promise<BullseyePersona | null> {
    const { data, error } = await supabase
      .from("bullseye_personas")
      .select("*")
      .eq("segment_id", segmentId)
      .maybeSingle();
    if (error) throw error;
    return data as BullseyePersona | null;
  },

  async upsert(input: Partial<BullseyePersona> & { segment_id: string }): Promise<BullseyePersona> {
    const { data, error } = await supabase
      .from("bullseye_personas")
      .upsert(input, { onConflict: "segment_id" })
      .select()
      .single();
    if (error) throw error;
    return data as BullseyePersona;
  },
};

// ─── Directives ───────────────────────────────────────────────────────────────
export const directivesRepo = {
  async getBySegment(segmentId: string): Promise<string> {
    const { data } = await supabase
      .from("bullseye_directives")
      .select("text")
      .eq("segment_id", segmentId)
      .maybeSingle();
    return (data?.text as string) || "";
  },

  async set(segmentId: string, text: string): Promise<void> {
    const { error } = await supabase
      .from("bullseye_directives")
      .upsert({ segment_id: segmentId, text }, { onConflict: "segment_id" });
    if (error) throw error;
  },
};

// ─── Sources (per client) ─────────────────────────────────────────────────────
export const sourcesRepo = {
  async listByClient(clientId: string): Promise<BullseyeSource[]> {
    const { data, error } = await supabase
      .from("bullseye_sources")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at");
    if (error) throw error;
    return (data || []) as BullseyeSource[];
  },

  async create(input: Partial<BullseyeSource>): Promise<BullseyeSource> {
    const { data, error } = await supabase
      .from("bullseye_sources")
      .insert(input)
      .select()
      .single();
    if (error) throw error;
    return data as BullseyeSource;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("bullseye_sources").delete().eq("id", id);
    if (error) throw error;
  },
};
