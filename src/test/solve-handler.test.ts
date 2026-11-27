import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleSolve } from "@/lib/solve-handler";
import { solveRiddle } from "@/lib/solve.server";

vi.mock("@/lib/solve.server", () => ({ solveRiddle: vi.fn() }));

describe("solve API response compatibility", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(["GET", "POST"])("returns all answer aliases and success for %s", async (method) => {
    vi.mocked(solveRiddle).mockResolvedValue({ answer: "NOVA", error: null, status: 200, source: "database" });
    const request = method === "GET"
      ? new Request("https://example.test/api/public/solve?riddle=cat")
      : new Request("https://example.test/api/public/solve", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ riddle: "cat" }),
        });
    const res = await handleSolve(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, answer: "NOVA", code: "NOVA", result: "NOVA", response: "NOVA", source: "database" });
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("marks missing input as failure without answer aliases", async () => {
    const res = await handleSolve(new Request("https://example.test/api/public/solve"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ success: false, error: "Missing riddle" });
    expect(solveRiddle).not.toHaveBeenCalled();
  });

  it("marks solver failures as unsuccessful without changing their status", async () => {
    vi.mocked(solveRiddle).mockResolvedValue({ answer: null, error: "No answer found", status: 422 });
    const res = await handleSolve(new Request("https://example.test/api/public/solve?riddle=cat"));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ success: false, error: "No answer found" });
  });
});