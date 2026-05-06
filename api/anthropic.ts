// POST /api/anthropic
// Proxy seguro a la Anthropic Messages API.
// La API key vive solo en env vars del backend, nunca llega al frontend.

import type { VercelRequest, VercelResponse } from "@vercel/node";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS para dev local con vercel dev (mismo origen no necesita esto, pero por si acaso)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY no configurada en el servidor" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const upstream = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    res.status(upstream.status);

    // Reenviar tal cual el JSON (con bloques content[], tool_use, etc.)
    res.setHeader("Content-Type", "application/json");
    return res.send(text);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: "Proxy error: " + message });
  }
}

// Ampliar timeout porque las generaciones con web_search pueden tardar
export const config = { maxDuration: 60 };
