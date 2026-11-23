import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

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

        <div className="mt-12 border-t border-border pt-6 text-xs text-muted-foreground">
          <p className="uppercase tracking-widest">API</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-muted-foreground">
{`POST /api/solve
{ "riddle": "..." }  →  { "answer": "CODE" }`}
          </pre>
        </div>
      </div>
    </main>
  );
}
