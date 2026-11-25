// /api/public/* bypasses published-site auth, so external callers (Roblox/Lua)
// can reach this without a session. Same behaviour as /api/solve.
import { createFileRoute } from "@tanstack/react-router";

import { CORS_HEADERS, handleSolve } from "@/lib/solve-handler";

export const Route = createFileRoute("/api/public/solve")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => handleSolve(request),
      POST: async ({ request }) => handleSolve(request),
    },
  },
});
