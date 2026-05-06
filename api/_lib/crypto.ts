// AES-256-GCM helper para encriptar/desencriptar API keys de clientes (Lemlist)
// La clave maestra vive en ENCRYPTION_KEY (env var de Vercel, 32+ chars)

import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error("ENCRYPTION_KEY no configurada o muy corta (mínimo 16 chars)");
  }
  // Derivar 32 bytes con SHA-256 — admite cualquier string de longitud >= 16
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // formato: iv.tag.ciphertext (todo en base64url)
  return [iv, tag, enc].map(b => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, encB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !encB64) throw new Error("Payload encriptado inválido");
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const enc = Buffer.from(encB64, "base64url");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
