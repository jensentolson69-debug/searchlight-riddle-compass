// Server-only: loaded dynamically from the /api/solve handler so it never reaches the browser bundle.
//
// Lookup (the user's rule, made fast):
//   - sab-trackerai.lovable.app's "Ask AI" and the database check (user's list + that site's Database
//     snapshot in tracker-database.server.ts) start at the same time.
//   - The database is checked twice in parallel (two models); if both agree the answer is sent at once —
//     it wins even when the website AI disagrees. Website-AI sentences and Google are also read twice.
//   - Otherwise the website AI's answer is used (short replies need no extra AI call).
//   - Only if both fail, ask Gemini with live Google Search.
import { cleanAnswer } from "./solve-answer";
import { loadAaNotesText } from "./aa-notes.server";
import { askTracker } from "./tracker.server";
import { TRACKER_DATABASE } from "./tracker-database.server";
import { isUnknown, quickTrackerCode } from "./tracker-reply";

// The user's own Sammy / game facts (from the original solver). Corrected per the user: cat = NOVA,
// "best brainrot" = STRAWBERRYELEPHANT.
const OWN_FACTS = `=== SAMMY DATABASE ===
NAME: SAMMY
AGE: 24
BIRTHDAY MONTH: FEBRUARY
FAVORITE COLOR: BLUE
FAVORITE PLAYER: RONALDO
FAVORITE PLAYER NUMBER: 7
FAVORITE NUMBER: 67
LUCKY NUMBER: SEVEN
FAVORITE FOOD: PIZZA
FAVORITE ARTIST: DRAKE
WORLD CUP WINNER: SPAIN
BEST FRIEND: STEAK
FAVORITE BRAINROT: MEOWL
FAVORITE TRAVIS SCOTT ALBUM: ASTROWORLD
FIRST TRAIT: LIGHTNING
LIGHTNING GIVES TRAIT: MATEO
COLOR OF POOP: BROWN
WHEN SAB CAME OUT: MAY162025
FAVORITE MEAL: PIZZA
FAVORITE SPORT: FOOTBALL
FAVORITE ANIMAL: SPIDER
FAVORITE GAME: ROBLOX
FAVORITE SEASON: SUMMER
FAVORITE DRINK: WATER
FAVORITE CONSOLE: PLAYSTATION
FAVORITE FOOTBALL CLUB: REAL MADRID
FAVORITE COUNTRY: BRAZIL
FAVORITE CITY: SAO PAULO
FAVORITE LANGUAGE: PORTUGUESE
ROBLOX USERNAME: SPYDERSAMMY
TWITTER: SPYDERSAMMY
DISCORD: ACE
LOCATION: BRAZIL
BIRTHPLACE: ALGERIA
NATIONALITY: BRAZILIAN
REAL NAME: SAMMY
CAT (PET) NAME: NOVA
FAVORITE MUTATION: YINGYANG

=== MUTATIONS (IN ORDER) ===
1: GOLD, 2: DIAMOND, 3: BLOODROT, 4: RAINBOW, 5: CANDY
6: LAVA, 7: GALAXY, 8: YINYANG, 9: RADIOACTIVE, 10: CURSED
11: DIVINE, 12: CYBER, 13: PHANTOM, 14: CRYSTAL, 15: ECLIPSE, 16: HACKER

=== MACHINES (IN ORDER) ===
1: RAINBOWMACHINE, 2: BUBBLEGUMMACHINE, 3: FUSEMACHINE, 4: CRAFTMACHINE
5: WITCHFUSE, 6: BRAINROTDEALER, 7: BRAINROTTRADER, 8: SANTASFUSE
9: SANTASSHOP, 10: NEWYEARSMACHINE, 11: DUELSMACHINE, 12: CUPIDSMACHINE
13: TRADEMACHINE, 14: DIVINEFUSE, 15: EGGINCUBATOR, 16: CYBERCRAFTMACHINE
17: SUMMERFUSE, 18: LOSTRADERS

=== RARITIES ===
1: COMMON, 2: UNCOMMON, 3: RARE, 4: EPIC, 5: LEGENDARY, 6: OG

=== OG BRAINROTS ===
1: STRAWBERRYELEPHANT, 2: MEOWL, 3: SKIBIDITOILET, 4: JOHNPORK, 5: JOHNPORK

=== GAME INFO ===
GAME NAME: STEALABRAINROT
RELEASE DATE: MAY162025
RELEASE DAY: FRIDAY
RELEASE MONTH: MAY
RELEASE YEAR: 2025
MAX PLAYERS: 8
GAME TYPE: SIMULATOR
FIRST UPDATE: MUTATIONS
BEST BRAINROT: STRAWBERRYELEPHANT
BEST MUTATION: HACKER
BEST BRAINROT FROM A SECRET LUCKY BLOCK: CELESTIALPEGASUS
STRONGEST BRAINROT (HIGHEST INCOME): SPYDERELEPHANT
RAREST BRAINROT: SPYDERELEPHANT
UNOBTAINABLE: HEADLESSHORSEMAN
FIRST BRAINROT: STRAWBERRYELEPHANT`;

const GOOGLE_PROMPT = `You are a riddle solver for the Roblox game "Steal a Brainrot" (SAB).
Solve the riddle and return ONLY the answer in UPPERCASE. No explanation, no punctuation, no spaces. Just the code.

${OWN_FACTS}

=== RULES ===
1. If riddle has multiple parts (+ or AND), solve each and concatenate WITHOUT spaces.
2. Use the database above as primary source.
3. If not in database, use Google Search.
4. Answer ONLY in UPPERCASE, no spaces, no punctuation.
5. Return ONLY the answer, nothing else.`;

const CONFIRMED = `"best brainrot" = STRAWBERRYELEPHANT. "best mutation" = HACKER (not YINGYANG). Best brainrot from a Secret Lucky Block = CELESTIALPEGASUS. Sammy's favourite/favorite brainrot = MEOWL (not STRAWBERRYELEPHANT). Sammy's cat = NOVA. Sammy's age = 24. Sammy's username = SPYDERSAMMY. Sammy's favourite mutation = YINGYANG (spelled exactly YINGYANG).`;

/** Database check: confirmed overrides + live Admin Abuse notes + user's list + tracker Database. */
function buildDatabasePrompt(aaNotes: string): string {
  const aaSection = aaNotes
    ? `\n\n=== LIVE ADMIN ABUSE NOTES (Sammy talking in-game about new updates/stuff — newest facts) ===\n${aaNotes}`
    : "";
  return `You turn riddles about the Roblox game "Steal a Brainrot" (SAB) and its creator Sammy (SpyderSammy) into a code.
The riddle is written as if Sammy is speaking ("my cat" = Sammy's cat, "my age" = Sammy's age).

Sources, in priority order:
A. CONFIRMED OVERRIDES (always win): ${CONFIRMED}
B. LIVE ADMIN ABUSE NOTES & THE USER'S OWN FACTS (below) — when they disagree with C, B wins.
C. THE TRACKER WEBSITE'S DATABASE (below).

Rules:
1. Solve every part of the riddle (parts joined by +, AND, or commas) and concatenate them in order WITHOUT spaces.
2. If a source names several options, use the main/first one.
3. Numbers stay as digits (24, not TWENTYFOUR) unless the source writes them as words.
4. If ANY part is not clearly answered by sources A–C, reply exactly UNKNOWN. Never guess.
5. Reply with ONLY the code in UPPERCASE: letters and digits, no spaces, no punctuation, no explanation.
${aaSection}

=== B. THE USER'S OWN FACTS ===
${OWN_FACTS}

=== C. TRACKER WEBSITE DATABASE ===
${TRACKER_DATABASE}`;
}

function buildGooglePrompt(aaNotes: string): string {
  if (!aaNotes) return GOOGLE_PROMPT;
  return `${GOOGLE_PROMPT}\n\n=== LIVE ADMIN ABUSE NOTES (from Sammy in-game) ===\n${aaNotes}`;
}

/** Small, fast prompt that turns the tracker website AI's sentence into a code. */
function extractPrompt(trackerReply: string): string {
  return `Turn the website AI's reply into the answer code for the riddle (Roblox game "Steal a Brainrot", creator Sammy).
Website AI reply: ${JSON.stringify(trackerReply)}
Confirmed overrides (always win): ${CONFIRMED}
Rules: answer every part of the riddle in order, joined WITHOUT spaces. If the reply names several options, use the first.
Numbers stay as digits. If the reply does not answer every part, reply exactly UNKNOWN.
Reply with ONLY the code in UPPERCASE letters and digits.`;
}

// The uploaded gemini-2.0-flash-exp is no longer offered by the gateway; this is the closest
// fast Gemini model that supports Google Search.
const MODEL = "google/gemini-3.1-flash-lite";
// Second, independent checker (the user asked for every answer to be checked twice). Both run in
// parallel, so checking twice costs no extra time.
const CHECK_MODEL = "google/gemini-3-flash-preview";

export type SolveSource = "database" | "tracker" | "google";
export type SolveResult = {
  answer: string | null;
  error: string | null;
  status: number;
  source?: SolveSource;
};

type AiResult = { code: string | null; error: SolveResult | null };

async function callAi(
  key: string,
  system: string,
  riddle: string,
  withSearch: boolean,
  model: string = MODEL,
): Promise<AiResult> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model,
      stream: false,
      ...(withSearch ? { tools: [{ type: "google_search" }] } : {}),
      messages: [
        { role: "system", content: system },
        { role: "user", content: riddle.slice(0, 1000) },
      ],
      temperature: 0,
      // 50 (the original cap) returned empty content whenever Google Search ran: the model hit
      // MAX_TOKENS before writing the answer. The prompt and cleanAnswer still keep answers short.
      max_tokens: 400,
    }),
  });

  if (!r.ok) {
    const body = await r.text().catch(() => "");
    if (r.status === 402) return { code: null, error: { answer: null, error: "Out of AI credits", status: 402 } };
    if (r.status === 429) return { code: null, error: { answer: null, error: "Rate limited", status: 429 } };
    console.error("AI gateway error", r.status, body.slice(0, 300));
    // Not 502: the preview proxy replaces 502 bodies with its own HTML error page.
    return { code: null, error: { answer: null, error: `AI error ${r.status}`, status: 500 } };
  }

  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  return { code: cleanAnswer(j.choices?.[0]?.message?.content), error: null };
}

type Checked = { code: string | null; candidates: string[]; error: SolveResult | null };

/** Ask two models at once; `code` is set only when both give the same real answer. */
async function checkTwice(key: string, system: string, riddle: string, withSearch: boolean): Promise<Checked> {
  const [a, b] = await Promise.all([
    callAi(key, system, riddle, withSearch, MODEL),
    callAi(key, system, riddle, withSearch, CHECK_MODEL),
  ]);
  const candidates = [a.code, b.code].filter((c): c is string => !isUnknown(c));
  const agreed = candidates.length === 2 && candidates[0] === candidates[1] ? candidates[0]! : null;
  // Stop only when BOTH checks hit credits/rate limits; one failed check just means "not confirmed".
  const hardError = a.error && b.error ? ([a.error, b.error].find((e) => e.status !== 500) ?? null) : null;
  return { code: agreed, candidates, error: hardError };
}

export async function solveRiddle(riddle: string): Promise<SolveResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { answer: null, error: "AI not configured", status: 500 };
  const ok = (answer: string, source: SolveSource, extra: object = {}): SolveResult => {
    console.log(`solve: ${source}`, JSON.stringify({ riddle, answer, ...extra }));
    return { answer, error: null, status: 200, source };
  };

  // Ask the website AI and check the database (twice, in parallel) at the same time.
  const trackerReplyPromise = askTracker(riddle);
  const aaNotes = await loadAaNotesText();
  const fromDb = await checkTwice(key, buildDatabasePrompt(aaNotes), riddle, false);
  if (fromDb.error) return fromDb.error;

  // Both database checks agree: it wins even over the website AI, so send it right away.
  if (fromDb.code) return ok(fromDb.code, "database");

  // Otherwise use the website AI's answer, read twice when it is a sentence.
  const trackerReply = await trackerReplyPromise;
  let trackerCode: string | null = null;
  if (trackerReply) {
    trackerCode = quickTrackerCode(riddle, trackerReply);
    if (!trackerCode) {
      const read = await checkTwice(key, extractPrompt(trackerReply), riddle, false);
      if (read.error) return read.error;
      // The two readings disagree: take the one a database check also gave.
      trackerCode = read.code ?? read.candidates.find((c) => fromDb.candidates.includes(c)) ?? null;
    }
    if (trackerCode && !isUnknown(trackerCode)) return ok(trackerCode, "tracker", { trackerReply, db: fromDb.candidates });
  }

  // Neither knows: Google Search, also checked twice.
  const fromGoogle = await checkTwice(key, buildGooglePrompt(aaNotes), riddle, true);
  if (fromGoogle.error) return fromGoogle.error;
  const known = [...fromDb.candidates];
  const googleCode =
    fromGoogle.code ?? fromGoogle.candidates.find((c) => known.includes(c)) ?? fromGoogle.candidates[0] ?? fromDb.candidates[0];
  if (!googleCode) return { answer: null, error: "No answer found", status: 422 };
  return ok(googleCode, "google", { trackerReply, google: fromGoogle.candidates });
}
