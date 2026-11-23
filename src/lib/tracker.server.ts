// Server-only: asks sab-trackerai.lovable.app's "Ask AI" (step 1 of the riddle cascade).
import { TRACKER_ASK_URL, TRACKER_ORIGIN, parseTrackerReply, trackerRequestBody } from "./tracker-reply";

const TIMEOUT_MS = 15_000;

/** Returns the tracker AI's plain-text reply, or null if it failed, timed out or refused. */
export async function askTracker(riddle: string): Promise<string | null> {
  try {
    const r = await fetch(TRACKER_ASK_URL, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        accept: "application/x-tss-framed, application/x-ndjson, application/json",
        "x-tsr-serverfn": "true",
        // The site's server function rejects requests without its own origin/referer.
        origin: TRACKER_ORIGIN,
        referer: `${TRACKER_ORIGIN}/`,
      },
      body: trackerRequestBody(riddle),
    });
    if (!r.ok) {
      console.error("tracker error", r.status);
      return null;
    }
    return parseTrackerReply(await r.text());
  } catch (e) {
    console.error("tracker failed", e instanceof Error ? e.message : e);
    return null;
  }
}
