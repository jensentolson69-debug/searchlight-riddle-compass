import { createFileRoute } from "@tanstack/react-router";

// Open CORS so external scripts (e.g. a Roblox/Lua client) can call it.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/solve")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const riddle =
          body && typeof body === "object" && "riddle" in body ? (body as { riddle: unknown }).riddle : undefined;
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
      },
    },
  },
});
