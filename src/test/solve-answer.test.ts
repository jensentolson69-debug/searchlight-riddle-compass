import { describe, expect, it } from "vitest";

import { cleanAnswer } from "@/lib/solve-answer";

describe("cleanAnswer", () => {
  it("uppercases and strips spaces and punctuation", () => {
    expect(cleanAnswer(" Real Madrid! ")).toBe("REALMADRID");
  });

  it("strips code fences and quotes", () => {
    expect(cleanAnswer('```\n"meowl"\n```')).toBe("MEOWL");
  });

  it("rejects answers shorter than 2 characters", () => {
    expect(cleanAnswer("a")).toBeNull();
  });

  it("rejects answers longer than 50 characters", () => {
    expect(cleanAnswer("A".repeat(51))).toBeNull();
  });

  it("returns null for empty output", () => {
    expect(cleanAnswer("")).toBeNull();
  });
});
