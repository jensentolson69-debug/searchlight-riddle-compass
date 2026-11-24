import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { solveRiddle } from "@/lib/solve.server";
import { TRACKER_ASK_URL, isUnknown, parseTrackerReply, quickTrackerCode } from "@/lib/tracker-reply";

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
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubFetch(answers: { tracker: string; database: string; extract?: string; google?: string }) {
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
        return aiReply(answers[kind] ?? "UNKNOWN");
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
});
