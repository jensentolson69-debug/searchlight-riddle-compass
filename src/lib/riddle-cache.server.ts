import { z } from "zod";
import { publicDatabase } from "./public-database.server";
import { cacheLifetime, riddleKey } from "./riddle-cache";

const ticketSchema = z.object({
  riddle: z.string().min(1).max(1000), answer: z.string().regex(/^[A-Z0-9]+$/).max(400),
  version: z.string().length(64), issued: z.number().int(),
});

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  const raw = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
async function signingKey() {
  const secret = process.env["RIDDLE_CONFIRMATION_SECRET"];
  if (!secret) return null;
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function factsVersion(facts: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(facts));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadConfirmedRiddle(riddle: string) {
  const db = publicDatabase();
  if (!db) return null;
  try {
    const { data, error } = await db.from("solved_riddles")
      .select("answer, facts_version, expires_at").eq("riddle_key", riddleKey(riddle))
      .gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error) console.error("riddle cache read failed", error.message);
    return error ? null : data;
  } catch { return null; }
}

/** A ticket authorizes saving only the exact answer produced by this server. */
export async function issueConfirmation(riddle: string, answer: string, version: string): Promise<string | null> {
  const key = await signingKey();
  if (!key) return null;
  const payload = encode(new TextEncoder().encode(JSON.stringify({ riddle, answer, version, issued: Date.now() })));
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}

export async function verifyConfirmation(ticket: string) {
  try {
    const key = await signingKey();
    const [payload, signature, extra] = ticket.split(".");
    if (!key || !payload || !signature || extra) return null;
    if (!await crypto.subtle.verify("HMAC", key, decode(signature), new TextEncoder().encode(payload))) return null;
    const parsed = ticketSchema.safeParse(JSON.parse(new TextDecoder().decode(decode(payload))));
    if (!parsed.success || parsed.data.issued > Date.now() || Date.now() - parsed.data.issued > 30 * 60 * 1000) return null;
    return parsed.data;
  } catch { return null; }
}

export async function confirmRedemption(ticket: string): Promise<"saved" | "invalid" | "unavailable"> {
  const verified = await verifyConfirmation(ticket);
  if (!verified) return "invalid";
  // Only server-signed answers can enter the trusted cache; client input cannot replace the code.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("solved_riddles").upsert({
    riddle_key: riddleKey(verified.riddle), riddle: verified.riddle, answer: verified.answer,
    facts_version: verified.version, verified_at: new Date(verified.issued).toISOString(),
    expires_at: new Date(verified.issued + cacheLifetime(verified.riddle)).toISOString(),
  });
  if (error) { console.error("riddle cache save failed", error.message); return "unavailable"; }
  return "saved";
}