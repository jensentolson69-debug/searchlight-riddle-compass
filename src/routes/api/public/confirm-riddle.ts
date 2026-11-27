import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { json } from "@/lib/solve-handler";

const input = z.object({ confirmation: z.string().min(1).max(8000), redeemed: z.literal(true) });
async function confirm(request: Request) {
  const url = new URL(request.url);
  const raw: unknown = request.method === "GET"
    ? { confirmation: url.searchParams.get("confirmation"), redeemed: url.searchParams.get("redeemed") === "true" }
    : await request.json().catch(() => null);
  const parsed = input.safeParse(raw);
  if (!parsed.success) return json({ success: false, error: "Successful redemption and confirmation required" }, 400);
  const { confirmRedemption } = await import("@/lib/riddle-cache.server");
  const result = await confirmRedemption(parsed.data.confirmation);
  if (result === "invalid") return json({ success: false, error: "Invalid or expired confirmation" }, 401);
  if (result === "unavailable") return json({ success: false, error: "Could not save confirmed answer" }, 503);
  return json({ success: true, saved: true });
}

export const Route = createFileRoute("/api/public/confirm-riddle")({
  server: { handlers: {
    GET: ({ request }) => confirm(request), POST: ({ request }) => confirm(request),
    OPTIONS: () => new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } }),
  } },
});