import { createFileRoute } from "@tanstack/react-router";

import { CORS_HEADERS, handleSolve } from "@/lib/solve-handler";

export const Route = createFileRoute("/api/solve")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async ({ request }) => handleSolve(request),
      POST: async ({ request }) => handleSolve(request),
    },
  },
});
