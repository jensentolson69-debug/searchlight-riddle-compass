// Server-only: loaded dynamically from the /api/solve handler so it never reaches the browser bundle.
import { cleanAnswer } from "./solve-answer";

const SYSTEM_PROMPT = `You are a riddle solver for the Roblox game "Steal a Brainrot" (SAB).
Solve the riddle and return ONLY the answer in UPPERCASE. No explanation, no punctuation, no spaces. Just the code.

=== SAMMY DATABASE ===
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
PET: SPIDER

=== MUTATIONS (IN ORDER) ===
1: GOLD, 2: DIAMOND, 3: BLOODROT, 4: RAINBOW, 5: CANDY
6: LAVA, 7: GALAXY, 8: YINYANG, 9: RADIOACTIVE, 10: CURSED
11: DIVINE, 12: CYBER, 13: PHANTOM, 14: CRYSTAL

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
STRONGEST BRAINROT: SPYDERELEPHANT
RAREST BRAINROT: SPYDERELEPHANT
UNOBTAINABLE: HEADLESSHORSEMAN
FIRST BRAINROT: STRAWBERRYELEPHANT

=== RULES ===
1. If riddle has multiple parts (+ or AND), solve each and concatenate WITHOUT spaces.
2. Use the database above as primary source.
3. If not in database, use Google Search.
4. Answer ONLY in UPPERCASE, no spaces, no punctuation.
5. Return ONLY the answer, nothing else.`;

// The uploaded gemini-2.0-flash-exp is no longer offered by the gateway; this is the closest
// fast Gemini model that supports Google Search.
const MODEL = "google/gemini-3.1-flash-lite";

export type SolveResult = { answer: string | null; error: string | null; status: number };

export async function solveRiddle(riddle: string): Promise<SolveResult> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { answer: null, error: "AI not configured", status: 500 };

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      tools: [{ type: "google_search" }],
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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
    if (r.status === 402) return { answer: null, error: "Out of AI credits", status: 402 };
    if (r.status === 429) return { answer: null, error: "Rate limited", status: 429 };
    console.error("AI gateway error", r.status, body.slice(0, 300));
    // Not 502: the preview proxy replaces 502 bodies with its own HTML error page.
    return { answer: null, error: `AI error ${r.status}`, status: 500 };
  }

  const j = (await r.json()) as { choices?: { message?: { content?: string } }[] };
  const answer = cleanAnswer(j.choices?.[0]?.message?.content);
  if (!answer) return { answer: null, error: "No answer found", status: 422 };
  return { answer, error: null, status: 200 };
}
