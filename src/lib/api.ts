// Wrapper del frontend para llamar a /api/*
// Reemplaza las llamadas directas a api.anthropic.com y al Worker de Lemlist

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<Record<string, unknown>>;
}

interface AnthropicRequest {
  model?: string;
  max_tokens?: number;
  messages: AnthropicMessage[];
  tools?: Array<Record<string, unknown>>;
}

export interface AnthropicResponse {
  text: string;
  webSources: { query: string; url: string }[];
  raw: unknown;
}

// ─── Anthropic ─────────────────────────────────────────────────────────────────
export async function callAnthropic(
  body: AnthropicRequest,
  timeoutMs = 60_000,
): Promise<AnthropicResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: body.model || "claude-sonnet-4-6",
        max_tokens: body.max_tokens || 2000,
        ...body,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) {
      let detail = "HTTP " + res.status;
      try {
        const errBody = await res.json();
        detail = errBody?.error?.message || errBody?.error || detail;
      } catch { /* keep default */ }
      throw new Error(detail);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || data.error);

    const blocks: Array<Record<string, unknown>> = data.content || [];
    const text = blocks
      .map(b => (b.type === "text" ? (b.text as string) : ""))
      .join("")
      .replace(/```json|```/g, "")
      .trim();
    const webSources = blocks
      .filter(b => b.type === "tool_use" && b.name === "web_search" && b.input)
      .map(b => {
        const input = b.input as { query?: string };
        return {
          query: input.query || "",
          url: "https://www.google.com/search?q=" + encodeURIComponent(input.query || ""),
        };
      });
    return { text, webSources, raw: data };
  } catch (e: unknown) {
    clearTimeout(timer);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("Timeout: la API tardó más de " + timeoutMs / 1000 + "s");
    }
    throw e;
  }
}

// ─── Lemlist ───────────────────────────────────────────────────────────────────
export async function callLemlist(
  client_id: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<unknown> {
  const res = await fetch("/api/lemlist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id, method, path, body }),
  });
  const text = await res.text();
  let parsed: unknown;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  if (!res.ok) {
    // Surface the FULL upstream body so podamos diagnosticar
    let errMsg = "Lemlist HTTP " + res.status;
    if (typeof parsed === "object" && parsed) {
      const obj = parsed as Record<string, unknown>;
      if ("error" in obj && typeof obj.error === "string") errMsg = obj.error;
      else if ("message" in obj && typeof obj.message === "string") errMsg = obj.message;
      else errMsg += ": " + JSON.stringify(parsed);
    } else if (typeof parsed === "string" && parsed) {
      errMsg += ": " + parsed.slice(0, 300);
    }
    console.error("[Lemlist]", { status: res.status, path, body: parsed });
    throw new Error(errMsg);
  }
  return parsed;
}

export async function setLemlistKey(
  client_id: string,
  api_key: string | null,
): Promise<{ ok: boolean; has_key: boolean }> {
  const res = await fetch("/api/lemlist-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id, api_key }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al guardar la API key");
  return data;
}
