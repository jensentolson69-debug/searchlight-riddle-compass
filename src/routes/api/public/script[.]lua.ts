// Serves the Roblox executor script as plain text for loadstring(game:HttpGet(...))().
import { createFileRoute } from "@tanstack/react-router";

import { robloxScript } from "@/lib/roblox-script";

export const Route = createFileRoute("/api/public/script.lua")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        return new Response(robloxScript(origin), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
