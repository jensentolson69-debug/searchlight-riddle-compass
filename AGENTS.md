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

- Keep solve response compatibility fields in the shared `solve-handler.ts`: successful replies expose `success`, `answer`, `code`, `result`, and `response`; failures expose `success: false` and `error` — both solve URLs must serve the same contract for Lua clients.
- Riddle-solving logic lives in `src/lib/solve.server.ts` and is loaded with a dynamic import inside the `/api/solve` handler — keeps the AI key and prompt out of the browser bundle.
- Answer normalisation is a pure helper (`src/lib/solve-answer.ts`) covered by `src/test/solve-answer.test.ts` — change both together.
- Riddle lookup races a versioned, redemption-confirmed cache against tracker Ask AI and double-checked database extraction; Google remains last and uncorroborated answers are rejected — preserve correctness while returning repeated answers early.
- Cache writes require a short-lived server-signed solve ticket and explicit script redemption success; exact normalized keys and source-version hashes prevent arbitrary answer injection and stale facts.
- Tracker refresh uses an authenticated managed hourly callback with a database lease, bounded same-origin asset reads, and literal-only parsing; retain the last good snapshot on failure and never execute tracker JavaScript.
