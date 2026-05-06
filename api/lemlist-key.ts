// POST /api/lemlist-key   → guarda/actualiza/elimina la Lemlist API key de un cliente
// Body: { client_id: "uuid", api_key: "..." | null }
//   - api_key string  → encripta y guarda
//   - api_key null    → elimina la key del cliente

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { encrypt } from "./_lib/crypto.js";
import { getAdminClient } from "./_lib/supabase-admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let body: { client_id?: string; api_key?: string | null };
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Body inválido" });
  }

  const { client_id, api_key } = body;
  if (!client_id) return res.status(400).json({ error: "client_id es obligatorio" });

  try {
    const supabase = getAdminClient();
    const encrypted = api_key ? encrypt(api_key) : null;

    const { error } = await supabase
      .from("clients")
      .update({ bullseye_lemlist_api_key_encrypted: encrypted })
      .eq("id", client_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true, has_key: !!encrypted });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: msg });
  }
}
