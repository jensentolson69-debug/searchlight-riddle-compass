import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

type AaNote = { id: string; content: string; source: string; created_at: string };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAB Riddle Solver — instant codes" },
      { name: "description", content: "Paste a Steal a Brainrot riddle and get the code back instantly." },
      { property: "og:title", content: "SAB Riddle Solver — instant codes" },
      { property: "og:description", content: "Paste a Steal a Brainrot riddle and get the code back instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [riddle, setRiddle] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState<AaNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [ownerKey, setOwnerKey] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function fetchNotes() {
    try {
      const res = await fetch("/api/public/aa-notes");
      const data = (await res.json()) as { notes?: AaNote[] };
      if (data.notes) setNotes(data.notes);
    } catch {
      // ignore transient load error
    }
  }

  useEffect(() => {
    void fetchNotes();
    const savedKey = window.localStorage.getItem("sab_aa_delete_key");
    if (savedKey) setOwnerKey(savedKey);
  }, []);

  function onOwnerKeyChange(value: string) {
    setOwnerKey(value);
    setDeleteError(null);
    if (value.trim()) window.localStorage.setItem("sab_aa_delete_key", value);
    else window.localStorage.removeItem("sab_aa_delete_key");
  }

  async function onAddNote(e: FormEvent) {
    e.preventDefault();
    if (!noteInput.trim() || !ownerKey.trim() || savingNote) return;
    setDeleteError(null);
    setSavingNote(true);
    try {
      const res = await fetch("/api/public/aa-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-owner-key": ownerKey.trim() },
        body: JSON.stringify({ message: noteInput.trim(), source: "manual" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setDeleteError(data.error ?? "Could not save note");
        return;
      }
      setNoteInput("");
      await fetchNotes();
    } finally {
      setSavingNote(false);
    }
  }

  async function onDeleteNote(id: string) {
    setDeleteError(null);
    const res = await fetch(`/api/public/aa-notes?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { "x-delete-key": ownerKey.trim() },
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setDeleteError(data.error ?? "Could not delete note");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  async function onClearNotes() {
    setDeleteError(null);
    const res = await fetch("/api/public/aa-notes?all=true", {
      method: "DELETE",
      headers: { "x-delete-key": ownerKey.trim() },
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setDeleteError(data.error ?? "Could not clear notes");
      return;
    }
    setNotes([]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!riddle.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    setError(null);
    try {
      const res = await fetch("/api/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riddle }),
      });
      const data = (await res.json()) as { answer?: string; error?: string };
      if (data.answer) setAnswer(data.answer);
      else setError(data.error ?? "Something went wrong");
    } catch {
      setError("Could not reach the solver");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-5 py-12 font-mono text-foreground">
      <div className="mx-auto max-w-xl">
        <p className="text-xs uppercase tracking-[0.3em] text-primary">Steal a Brainrot</p>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight sm:text-5xl">Riddle solver</h1>
        <p className="mt-3 text-sm text-muted-foreground">Paste the riddle, get the code.</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-3">
          <textarea
            value={riddle}
            onChange={(e) => setRiddle(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Sammy's favorite brainrot + his lucky number"
            className="w-full resize-none rounded-lg border border-input bg-card p-4 text-base text-card-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            type="submit"
            disabled={loading || !riddle.trim()}
            className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
          >
            {loading ? "Solving…" : "Solve"}
          </button>
        </form>

        {answer && (
          <div className="mt-8 rounded-lg border border-primary bg-card p-6 text-center shadow-glow">
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Code</p>
            <p className="mt-2 break-all text-3xl font-bold text-primary">{answer}</p>
          </div>
        )}
        {error && <p className="mt-6 text-sm text-destructive">{error}</p>}

        <section className="mt-12 border-t border-border pt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs uppercase tracking-widest text-primary">Live Admin Abuse Notes</h2>
            {notes.length > 0 && ownerKey.trim() && (
              <button type="button" onClick={onClearNotes} className="text-xs text-muted-foreground hover:text-destructive">
                Clear all
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Saved automatically from your script during Admin Abuse, or add facts Sammy mentions here.
          </p>

          <form onSubmit={onAddNote} className="mt-3 flex gap-2">
            <input
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              maxLength={1000}
              placeholder="Sammy said: new mutation is Cosmic..."
              className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-2 text-sm text-card-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              type="submit"
              disabled={savingNote || !noteInput.trim() || !ownerKey.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary-foreground transition hover:brightness-110 disabled:opacity-40"
            >
              {savingNote ? "Saving…" : "Save"}
            </button>
          </form>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="password"
              value={ownerKey}
              onChange={(e) => onOwnerKeyChange(e.target.value)}
              placeholder="Owner key (required to add or delete notes)"
              className="min-w-0 flex-1 rounded-lg border border-input bg-card px-3 py-1.5 text-xs text-card-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          {deleteError && <p className="mt-2 text-xs text-destructive">{deleteError}</p>}

          {notes.length > 0 ? (
            <ul className="mt-4 space-y-2">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs">
                  <span className="break-words text-card-foreground">{n.content}</span>
                  {ownerKey.trim() && (
                    <button
                      type="button"
                      onClick={() => onDeleteNote(n.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No Admin Abuse notes saved yet.</p>
          )}
        </section>

        <div className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          <p className="uppercase tracking-widest">API</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-muted-foreground">
{`POST /api/public/solve
{ "riddle": "..." }  →  { "answer": "CODE" }

POST /api/public/aa-notes
{ "message": "Sammy said..." }  →  { "saved": true }`}
          </pre>
        </div>
      </div>
    </main>
  );
}
