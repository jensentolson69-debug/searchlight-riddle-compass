import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { solveRiddle } from "@/lib/solve.server";
import { TRACKER_ASK_URL, isUnknown, parseTrackerReply } from "@/lib/tracker-reply";

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

describe("solveRiddle lookup order", () => {
  let calls: { url: string; search: boolean }[];

  beforeEach(() => {
    vi.stubEnv("LOVABLE_API_KEY", "test-key");
    calls = [];
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubFetch(trackerText: string, trackerCode: string, googleCode: string) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const search = typeof init?.body === "string" && init.body.includes("google_search");
        calls.push({ url, search });
        if (url === TRACKER_ASK_URL) return new Response(trackerResponse(trackerText));
        return aiReply(search ? googleCode : trackerCode);
      }),
    );
  }

  it("asks the tracker website first and skips Google when it answers", async () => {
    stubFetch("Nova, 24 years old, and Strawberry Elephant.", "NOVA24STRAWBERRYELEPHANT", "WRONG");
    const r = await solveRiddle("what my cat name + my age + the best brainrot");
    expect(r.answer).toBe("NOVA24STRAWBERRYELEPHANT");
    expect(r.source).toBe("tracker");
    expect(calls[0]?.url).toBe(TRACKER_ASK_URL);
    expect(calls.some((c) => c.search)).toBe(false);
  });

  it("falls back to Google Search only when the website and its database can't answer", async () => {
    stubFetch("I don't know.", "UNKNOWN", "SPAIN");
    const r = await solveRiddle("who won the world cup");
    expect(r.answer).toBe("SPAIN");
    expect(r.source).toBe("google");
    expect(calls[0]?.url).toBe(TRACKER_ASK_URL);
    expect(calls.at(-1)?.search).toBe(true);
  });
});
