<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Riddle-solving logic lives in `src/lib/solve.server.ts` and is loaded with a dynamic import inside the `/api/solve` handler — keeps the AI key and prompt out of the browser bundle.
- Answer normalisation is a pure helper (`src/lib/solve-answer.ts`) covered by `src/test/solve-answer.test.ts` — change both together.
- Riddle lookup in `solve.server.ts`: tracker site Ask AI (`tracker.server.ts`) and a database check (user facts + `tracker-database.server.ts`) start in parallel; a known database answer returns at once, else the tracker reply (short ones parsed without AI via `quickTrackerCode`), else Gemini with Google Search; covered by `src/test/solve-cascade.test.ts` — keeps answers fast while Google stays the last resort.
