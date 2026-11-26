// Public endpoint (open CORS, no auth) so the Roblox script can save Sammy's live
// Admin Abuse messages/updates to the database and the web UI can manage them.
import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

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
      GET: async ({ request }) => {
        // Executors that can only do GET (game:HttpGet) save a note with ?message=...
        const add = new URL(request.url).searchParams.get("message");
        if (add !== null) {
          const text = add.trim();
          if (!text) return json({ error: "Missing message" }, 400);
          if (text.length > 1000) return json({ error: "Message too long" }, 400);
          const { addAaNote } = await import("@/lib/aa-notes.server");
          const note = await addAaNote(text, "Sammy");
          if (!note) return json({ error: "Could not save note" }, 500);
          return json({ saved: true, note });
        }
        const { listAaNotes } = await import("@/lib/aa-notes.server");
        const notes = await listAaNotes();
        return json({ notes });
      },
      POST: async ({ request }) => {
        // Accept JSON, form, or plain-text bodies (executors differ).
        const rawText = (await request.text().catch(() => "")).trim();
        let obj: Record<string, unknown> = {};
        if (rawText.startsWith("{")) {
          try {
            const parsed: unknown = JSON.parse(rawText);
            if (parsed && typeof parsed === "object") obj = parsed as Record<string, unknown>;
          } catch {
            return json({ error: "Invalid JSON" }, 400);
          }
        } else if (/^[a-z]+=/i.test(rawText)) {
          obj = Object.fromEntries(new URLSearchParams(rawText));
        } else if (rawText) {
          obj = { message: rawText };
        }
        const raw = obj["message"] ?? obj["text"] ?? obj["content"];
        if (typeof raw !== "string" || raw.trim() === "") {
          return json({ error: "Missing message" }, 400);
        }
        if (raw.length > 1000) return json({ error: "Message too long" }, 400);
        const source = typeof obj["source"] === "string" ? obj["source"] : "script";
        const { addAaNote } = await import("@/lib/aa-notes.server");
        const note = await addAaNote(raw, source);
        if (!note) return json({ error: "Could not save note" }, 500);
        return json({ saved: true, note });
      },
      DELETE: async ({ request }) => {
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