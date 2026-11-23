import { createFileRoute } from "@tanstack/react-router";

import { CORS_HEADERS, handleSolvePost } from "@/lib/solve-handler";

export const Route = createFileRoute("/api/solve")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      POST: async ({ request }) => handleSolvePost(request),
    },
  },
});
