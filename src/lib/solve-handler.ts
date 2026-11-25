// Shared logic for the riddle endpoint, used by both /api/solve and
// /api/public/solve. This module holds no secrets: the solver (with the AI
// key and prompt) is loaded dynamically inside the handler so it never lands
// in the browser bundle.
//
// Roblox executors send requests in many shapes, so the riddle is accepted from
// a GET query (?riddle=), a JSON body, a form body, or plain text.

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function pickRiddle(obj: unknown): string | undefined {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  const v = o["riddle"] ?? o["question"] ?? o["text"] ?? o["message"];
  return typeof v === "string" ? v : undefined;
}

/** Pull the riddle out of any request shape an executor might send. */
export async function readRiddle(request: Request): Promise<string | undefined> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("riddle") ?? url.searchParams.get("q");
  if (fromQuery) return fromQuery;
  if (request.method !== "POST") return undefined;

  const raw = await request.text().catch(() => "");
  const text = raw.trim();
  if (!text) return undefined;
  if (text.startsWith("{")) {
    try {
      return pickRiddle(JSON.parse(text));
    } catch {
      return undefined;
    }
  }
  if (/^[a-z]+=/i.test(text)) {
    const params = new URLSearchParams(text);
    const v = params.get("riddle") ?? params.get("q");
    if (v) return v;
  }
  return text;
}

export async function handleSolve(request: Request): Promise<Response> {
  const riddle = await readRiddle(request);
  if (typeof riddle !== "string" || riddle.trim() === "") {
    return json({ error: "Missing riddle" }, 400);
  }
  if (riddle.length > 1000) return json({ error: "Riddle too long" }, 400);

  try {
    const { solveRiddle } = await import("@/lib/solve.server");
    const result = await solveRiddle(riddle.trim());
    if (result.error) return json({ error: result.error }, result.status);
    return json({ answer: result.answer });
  } catch (e) {
    console.error("solve failed", e);
    return json({ error: "Server error" }, 500);
  }
}

/** Kept for existing callers. */
export const handleSolvePost = handleSolve;
