import { describe, expect, it } from "vitest";

import { cleanAnswer } from "@/lib/solve-answer";

describe("cleanAnswer", () => {
  it("uppercases and strips spaces and punctuation", () => {
    expect(cleanAnswer(" Real Madrid! ")).toBe("REALMADRID");
  });

  it("strips code fences and quotes", () => {
    expect(cleanAnswer('```\n"meowl"\n```')).toBe("MEOWL");
  });

  it("keeps a single-character answer", () => {
    expect(cleanAnswer("4")).toBe("4");
  });

  it("keeps a single letter answer", () => {
    expect(cleanAnswer("a")).toBe("A");
  });

  it("rejects answers longer than 50 characters", () => {
    expect(cleanAnswer("A".repeat(51))).toBeNull();
  });

  it("returns null for empty output", () => {
    expect(cleanAnswer("")).toBeNull();
  });
});
