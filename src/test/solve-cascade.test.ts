import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { solveRiddle } from "@/lib/solve.server";
import { TRACKER_ASK_URL, isUnknown, parseTrackerReply, quickTrackerCode } from "@/lib/tracker-reply";
import { loadConfirmedRiddle } from "@/lib/riddle-cache.server";

vi.mock("@/lib/riddle-cache.server", () => ({
  loadConfirmedRiddle: vi.fn(async () => null), factsVersion: vi.fn(async () => "a".repeat(64)),
}));
vi.mock("@/lib/tracker-sync.server", async () => {
  const { TRACKER_DATABASE } = await import("@/lib/tracker-database.server");
  return { loadTrackerDatabase: vi.fn(async () => TRACKER_DATABASE) };
});
vi.mock("@/lib/aa-notes.server", () => ({ loadAaNotesText: vi.fn(async () => "") }));

function trackerResponse(text: string): string {
  return JSON.stringify({
    t: 10,
    i: 0,
    p: {
      k: ["result", "error", "context"],
      v: [{ t: 10, i: 1, p: { k: ["text", "error"], v: [{ t: 1, s: text }, { t: 2, s: 0 }] }, o: 0 }, { t: 2, s: 1 }, { t: 11, i: 2, p: { k: [], v: [] }, o: 0 }],
    },
    o: 0,
  });
}

const aiReply = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }));

describe("parseTrackerReply", () => {
  it("reads the tracker AI's text", () => {
    expect(parseTrackerReply(trackerResponse("Nova, 24 years old, and Strawberry Elephant."))).toBe(
      "Nova, 24 years old, and Strawberry Elephant.",
    );
  });

  it("treats the tracker's refusal as no answer", () => {
    expect(parseTrackerReply(trackerResponse("Can't help you with that."))).toBeNull();
  });

  it("treats a broken response as no answer", () => {
    expect(parseTrackerReply("<html>")).toBeNull();
  });
});

describe("isUnknown", () => {
  it("flags UNKNOWN", () => expect(isUnknown("UNKNOWN")).toBe(true));
  it("accepts a real code", () => expect(isUnknown("NOVA24STRAWBERRYELEPHANT")).toBe(false));
});

describe("quickTrackerCode", () => {
  it("reads a short reply without an AI call", () => expect(quickTrackerCode("newest mutation?", "Hacker (15×, reported)")).toBe("HACKER"));
  it("leaves multi-part riddles to the AI", () => expect(quickTrackerCode("my cat + my age", "Nova")).toBeNull());
  it("never turns 'I don't know' into a code", () => expect(quickTrackerCode("newest mutation?", "I don't know.")).toBeNull());
});

describe("solveRiddle lookup order", () => {
  type Kind = "tracker" | "database" | "extract" | "google";
  let calls: Kind[];

  beforeEach(() => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    calls = [];
    vi.mocked(loadConfirmedRiddle).mockResolvedValue(null);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  type Answer = string | [string, string]; // [first model, second checker]
  function stubFetch(answers: { tracker: string; database: Answer; extract?: Answer; google?: Answer }) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === TRACKER_ASK_URL) {
          calls.push("tracker");
          return new Response(trackerResponse(answers.tracker));
        }
        const body = typeof init?.body === "string" ? init.body : "";
        const kind: Kind = body.includes("google_search") ? "google" : body.includes("TRACKER WEBSITE DATABASE") ? "database" : "extract";
        calls.push(kind);
        const a = answers[kind] ?? "UNKNOWN";
        const isChecker = body.includes("gemini-3-flash-preview");
        return aiReply(typeof a === "string" ? a : a[isChecker ? 1 : 0]);
      }),
    );
  }

  it("asks the website AI and checks the database together, sending the database answer at once", async () => {
    stubFetch({ tracker: "Nova, 24 years old, and Strawberry Elephant.", database: "NOVA24STRAWBERRYELEPHANT" });
    const r = await solveRiddle("what my cat name + my age + the best brainrot");
    expect(r.answer).toBe("NOVA24STRAWBERRYELEPHANT");
    expect(r.source).toBe("database");
    expect(calls).toContain("tracker");
    expect(calls).not.toContain("google");
  });

  it("uses the database when the website AI says something different", async () => {
    stubFetch({ tracker: "Red.", database: "BLUE" });
    const r = await solveRiddle("what is my favorite color");
    expect(r.answer).toBe("BLUE");
  });

  it("sends the website AI's answer when the database doesn't know", async () => {
    stubFetch({ tracker: "Hacker (15×, reported)", database: "UNKNOWN" });
    const r = await solveRiddle("what is the newest mutation");
    expect(r.answer).toBe("HACKER");
    expect(r.source).toBe("tracker");
    expect(calls).not.toContain("google");
  });

  it("falls back to Google Search only when the website and its database can't answer", async () => {
    stubFetch({ tracker: "Can't help you with that.", database: "UNKNOWN", google: "SPAIN" });
    const r = await solveRiddle("who won the world cup");
    expect(r.answer).toBe("SPAIN");
    expect(r.source).toBe("google");
    expect(calls.at(-1)).toBe("google");
  });

  it("checks the database twice at the same time and sends it only when both agree", async () => {
    stubFetch({ tracker: "SpyderSammy, Strawberry Elephant, Yin Yang.", database: "SPYDERSAMMYSTRAWBERRYELEPHANTYINGYANG" });
    const r = await solveRiddle("What my username best brainrot in the game and my favourite mutation");
    expect(r.answer).toBe("SPYDERSAMMYSTRAWBERRYELEPHANTYINGYANG");
    expect(r.source).toBe("database");
    expect(calls.filter((c) => c === "database")).toHaveLength(2);
  });

  it("does not trust the database when its two checks disagree, and uses the website AI instead", async () => {
    stubFetch({ tracker: "Hacker (15×, reported)", database: ["HACKER", "CYBER"] });
    const r = await solveRiddle("what is the newest mutation");
    expect(r.answer).toBe("HACKER");
    expect(r.source).toBe("tracker");
  });

  it("when the two readings of the website AI disagree, takes the one the database also gave", async () => {
    stubFetch({ tracker: "Nova and 24.", database: ["NOVA24", "UNKNOWN"], extract: ["NOVA24", "NOVATWENTYFOUR"] });
    const r = await solveRiddle("my cat + my age");
    expect(r.answer).toBe("NOVA24");
  });

  it("checks Google twice too", async () => {
    stubFetch({ tracker: "Can't help you with that.", database: "UNKNOWN", google: "SPAIN" });
    await solveRiddle("who won the world cup");
    expect(calls.filter((c) => c === "google")).toHaveLength(2);
  });

  it("returns a confirmed NOVA answer while website replies are still pending", async () => {
    vi.mocked(loadConfirmedRiddle).mockResolvedValue({ answer: "NOVA", facts_version: "a".repeat(64), expires_at: new Date(Date.now() + 60000).toISOString() });
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const result = await solveRiddle("What is my cat name?");
    expect(result.answer).toBe("NOVA");
    expect(result.source).toBe("cache");
  });

  it("does not use an old cached YINGYANG answer after facts change", async () => {
    vi.mocked(loadConfirmedRiddle).mockResolvedValue({ answer: "YINGYANG", facts_version: "b".repeat(64), expires_at: new Date(Date.now() + 60000).toISOString() });
    stubFetch({ tracker: "Yingyang", database: "HACKER" });
    expect((await solveRiddle("What is the best mutation?")).answer).toBe("HACKER");
  });

  it("never sends an unconfirmed Google guess when both checks disagree", async () => {
    stubFetch({ tracker: "Can't help you with that.", database: "UNKNOWN", google: ["SPAIN", "FRANCE"] });
    const result = await solveRiddle("Who won the world cup?");
    expect(result.answer).toBeNull();
    expect(result.status).toBe(422);
  });
});
