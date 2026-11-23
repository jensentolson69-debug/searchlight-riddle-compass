// Shared POST logic for the riddle endpoint, used by both /api/solve and
// /api/public/solve. This module holds no secrets: the solver (with the AI
// key and prompt) is loaded dynamically inside the handler so it never lands
// in the browser bundle.

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export async function handleSolvePost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const riddle =
    body && typeof body === "object" && "riddle" in body
      ? (body as { riddle: unknown }).riddle
      : undefined;

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
