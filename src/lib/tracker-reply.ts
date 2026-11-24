// Pure helpers for talking to sab-trackerai.lovable.app's "Ask AI" server function.
import { cleanAnswer } from "./solve-answer";

export const TRACKER_ORIGIN = "https://sab-trackerai.lovable.app";
export const TRACKER_ASK_URL = `${TRACKER_ORIGIN}/_serverFn/02c7eb98dcc942066dc5ebda9810837cb3d6a42389e9598127d31b50639cd9dd`;

/** The tracker's own canned refusal (rate limit / filter); treat as "no answer". */
const REFUSALS = [/can'?t help you with that/i];

/** Request body in TanStack Start's serialized format: { data: { prompt } }. */
export function trackerRequestBody(prompt: string): string {
  return JSON.stringify({
    t: { t: 10, i: 0, p: { k: ["data"], v: [{ t: 10, i: 1, p: { k: ["prompt"], v: [{ t: 1, s: prompt }] }, o: 0 }] }, o: 0 },
    f: 127,
    m: [],
  });
}

type Node = { t?: number; s?: unknown; p?: { k?: unknown[]; v?: unknown[] } };

function field(node: unknown, key: string): unknown {
  const n = node as Node | null;
  if (!n || n.t !== 10 || !n.p || !Array.isArray(n.p.k) || !Array.isArray(n.p.v)) return undefined;
  const i = n.p.k.indexOf(key);
  return i >= 0 ? n.p.v[i] : undefined;
}

/** Pull `result.text` out of the tracker's serialized response; null when missing, empty or a refusal. */
export function parseTrackerReply(raw: string): string | null {
  let root: unknown;
  try {
    root = JSON.parse(raw);
  } catch {
    return null;
  }
  const text = field(field(root, "result"), "text") as Node | undefined;
  if (!text || text.t !== 1 || typeof text.s !== "string") return null;
  const s = text.s.trim();
  if (!s || REFUSALS.some((r) => r.test(s))) return null;
  return s;
}

/** True when the extraction model says the sources do not contain the answer. */
export function isUnknown(code: string | null): boolean {
  return !code || /^(UNKNOWN|NONE|NULL|NA|IDK)$/.test(code) || code.includes("UNKNOWN");
}

const MULTI_PART = /\+|&|,|\band\b/i;
const NOT_AN_ANSWER = /\b(know|sorry|not|no|unknown|unsure|unclear|can'?t|cannot|don'?t)\b/i;

/**
 * Turn a short, single-part tracker reply ("Red.", "Hacker (15x, reported)") straight into a code,
 * skipping an AI call. Returns null when the reply needs the AI to read it.
 */
export function quickTrackerCode(riddle: string, reply: string): string | null {
  if (MULTI_PART.test(riddle)) return null;
  const core = reply.replace(/\([^)]*\)/g, "").replace(/[.!]+$/, "").trim();
  if (!core || MULTI_PART.test(core) || NOT_AN_ANSWER.test(core)) return null;
  if (core.split(/\s+/).length > 3) return null;
  return cleanAnswer(core);
}
