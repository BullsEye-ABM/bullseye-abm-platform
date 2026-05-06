// POST /api/lemlist
// Proxy a la API de Lemlist. La API key NO viaja del frontend:
// el frontend envía solo client_id, y este endpoint:
//   1. Lee bullseye_lemlist_api_key_encrypted desde la tabla clients
//   2. La desencripta con AES-256-GCM
//   3. Hace la llamada a Lemlist con Basic Auth
//   4. Devuelve la respuesta tal cual al frontend
//
// Body esperado:
// {
//   "client_id": "uuid",
//   "method": "GET" | "POST" | "PATCH" | "DELETE",
//   "path": "/api/campaigns",            // path relativo dentro de api.lemlist.com
//   "body": {...}                        // opcional
// }

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { decrypt } from "./_lib/crypto.js";
import { getAdminClient } from "./_lib/supabase-admin.js";

const LEMLIST_BASE = "https://api.lemlist.com";

interface LemlistProxyBody {
  client_id?: string;
  method?: string;
  path?: string;
  body?: unknown;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let payload: LemlistProxyBody;
  try {
    payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: "Body inválido" });
  }

  const { client_id, method = "GET", path, body } = payload;
  if (!client_id || !path) {
    return res.status(400).json({ error: "client_id y path son obligatorios" });
  }
  if (!path.startsWith("/")) {
    return res.status(400).json({ error: "path debe comenzar con /" });
  }

  // 1. Recuperar y desencriptar API key del cliente
  let apiKey: string;
  try {
    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from("clients")
      .select("bullseye_lemlist_api_key_encrypted")
      .eq("id", client_id)
      .single();

    if (error) return res.status(404).json({ error: "Cliente no encontrado: " + error.message });
    const enc = data?.bullseye_lemlist_api_key_encrypted as string | null;
    if (!enc) return res.status(400).json({ error: "Este cliente no tiene API key de Lemlist configurada" });

    apiKey = decrypt(enc);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: "No se pudo desencriptar la API key: " + msg });
  }

  // 2. Llamada a Lemlist
  try {
    const upstream = await fetch(LEMLIST_BASE + path, {
      method,
      headers: {
        "Authorization": "Basic " + Buffer.from(apiKey + ":").toString("base64"),
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text || "{}");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: "Lemlist proxy error: " + msg });
  }
}

export const config = { maxDuration: 30 };
