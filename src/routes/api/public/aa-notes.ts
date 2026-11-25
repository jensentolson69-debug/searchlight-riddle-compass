// Public endpoint (open CORS, no auth) so the Roblox script can save Sammy's live
// Admin Abuse messages/updates to the database and the web UI can manage them.
import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-delete-key",
} as const;

function keysMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/aa-notes")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async () => {
        const { listAaNotes } = await import("@/lib/aa-notes.server");
        const notes = await listAaNotes();
        return json({ notes });
      },
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const obj = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
        const raw = obj["message"] ?? obj["text"] ?? obj["content"];
        if (typeof raw !== "string" || raw.trim() === "") {
          return json({ error: "Missing message" }, 400);
        }
        if (raw.length > 1000) return json({ error: "Message too long" }, 400);
        const source = typeof obj["source"] === "string" ? obj["source"] : "script";
        const { addAaNote } = await import("@/lib/aa-notes.server");
        const note = await addAaNote(raw, source);
        if (!note) return json({ error: "Could not save note" }, 500);
        return json({ saved: true, note }, 201);
      },
      DELETE: async ({ request }) => {
        const expectedKey = process.env["AA_NOTES_DELETE_KEY"]?.trim();
        if (!expectedKey) {
          return json({ error: "Delete key not configured" }, 503);
        }
        const providedKey = request.headers.get("x-delete-key")?.trim() ?? "";
        if (!providedKey || !keysMatch(providedKey, expectedKey)) {
          return json({ error: "Invalid delete key" }, 401);
        }
        const url = new URL(request.url);
        const id = url.searchParams.get("id");
        const all = url.searchParams.get("all");
        const { deleteAaNote, clearAaNotes } = await import("@/lib/aa-notes.server");
        if (all === "true") {
          const ok = await clearAaNotes();
          return ok ? json({ cleared: true }) : json({ error: "Could not clear notes" }, 500);
        }
        if (!id) return json({ error: "Missing id" }, 400);
        const ok = await deleteAaNote(id);
        return ok ? json({ deleted: true }) : json({ error: "Could not delete note" }, 500);
      },
    },
  },
});