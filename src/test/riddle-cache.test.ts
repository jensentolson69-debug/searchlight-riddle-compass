import { afterEach, describe, expect, it, vi } from "vitest";
import { cacheLifetime, raceConfirmed, riddleKey } from "@/lib/riddle-cache";
import { issueConfirmation, verifyConfirmation } from "@/lib/riddle-cache.server";

afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("confirmed riddle cache", () => {
  it("matches the same riddle without changing word order", () => {
    expect(riddleKey("  What is my cat name?  ")).toBe("what is my cat name");
    expect(riddleKey("cat + age")).not.toBe(riddleKey("age + cat"));
  });
  it("a miss waits for the fresh answer", async () => {
    expect(await raceConfirmed(Promise.resolve(null), Promise.resolve("NOVA"))).toBe("NOVA");
  });
  it("a known correct answer beats a pending website call", async () => {
    expect(await raceConfirmed(Promise.resolve("NOVA"), new Promise<string>(() => {}))).toBe("NOVA");
  });
  it("expires current-update riddles sooner than stable facts", () => {
    expect(cacheLifetime("What got nerfed last time?")).toBe(7200000);
    expect(cacheLifetime("What is my cat name?")).toBe(86400000);
  });
  it("accepts only server-signed exact answers", async () => {
    vi.stubEnv("RIDDLE_CONFIRMATION_SECRET", "test-signing-secret");
    const ticket = await issueConfirmation("What is my cat name?", "NOVA", "a".repeat(64));
    if (!ticket) throw new Error("Missing confirmation");
    expect((await verifyConfirmation(ticket))?.answer).toBe("NOVA");
    expect(await verifyConfirmation(`x${ticket}`)).toBeNull();
  });
  it("rejects expired confirmation rather than saving stale answers", async () => {
    vi.stubEnv("RIDDLE_CONFIRMATION_SECRET", "test-signing-secret");
    vi.useFakeTimers();
    const ticket = await issueConfirmation("What is my cat name?", "NOVA", "a".repeat(64));
    if (!ticket) throw new Error("Missing confirmation");
    vi.advanceTimersByTime(30 * 60 * 1000 + 1);
    expect(await verifyConfirmation(ticket)).toBeNull();
  });
});