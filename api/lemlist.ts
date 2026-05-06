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

    apiKey = decrypt(enc).trim();
    console.log("[lemlist] decrypted key length:", apiKey.length, "preview:", apiKey.slice(0, 6) + "..." + apiKey.slice(-4));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(500).json({ error: "No se pudo desencriptar la API key: " + msg });
  }

  // 2. Llamada a Lemlist — pasamos el api_key por TODOS los métodos posibles
  //    (Basic Auth + Bearer + query param) para máxima compatibilidad v1/v2.
  try {
    const url = new URL(LEMLIST_BASE + path);
    if (!url.searchParams.has("api_key")) url.searchParams.set("api_key", apiKey);

    console.log("[lemlist] calling:", method, url.pathname + url.search.replace(apiKey, "***"));

    // Lemlist v1: Basic Auth con username vacío y api_key como PASSWORD: ":" + apiKey
    const upstream = await fetch(url.toString(), {
      method,
      headers: {
        "Authorization": "Basic " + Buffer.from(":" + apiKey).toString("base64"),
        "Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await upstream.text();
    console.log("[lemlist] response status:", upstream.status, "body:", text.slice(0, 300));

    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    return res.send(text || "{}");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return res.status(502).json({ error: "Lemlist proxy error: " + msg });
  }
}

export const config = { maxDuration: 30 };
