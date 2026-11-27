import { describe, expect, it } from "vitest";
import { extractTrackerDatabase, trackerPage } from "@/lib/tracker-snapshot";

describe("tracker auto refresh", () => {
  it("reads published database literals regardless of minified variable names", () => {
    const data = extractTrackerDatabase('const renamed={sammy:[{label:`Cat`,value:`Nova`}],mutations:[{name:`Hacker`}],obtain:[{method:`Lucky Block`}]};');
    expect(data ? JSON.parse(data) : null).toEqual({ sammy: [{ label: "Cat", value: "Nova" }], mutations: [{ name: "Hacker" }], obtain: [{ method: "Lucky Block" }] });
  });
  it("never executes dynamic website expressions", () => {
    expect(extractTrackerDatabase('const d={sammy:fetch("https://evil.example"),mutations:[],obtain:[]};')).toBeNull();
  });
  it("reads the tracker mutation pair format without executing its map callback", () => {
    const data = extractTrackerDatabase('const d={sammy:[],obtain:[],mutations:[[`Hacker`,`15x`]].map(([n,m])=>({name:n,note:`${m} income · one mutation per Brainrot`}))};');
    expect(data ? JSON.parse(data)["mutations"] : null).toEqual([{ name: "Hacker", note: "15x income · one mutation per Brainrot" }]);
  });
  it("rejects unrelated or changed data shapes", () => {
    expect(extractTrackerDatabase('const unrelated={label:`Cat`,value:`Nova`};')).toBeNull();
  });
  it("does not follow assets hosted outside the tracker", () => {
    const result = trackerPage('<body>BrainrotIntel<script src="https://evil.example/assets/routes-x.js"></script><link href="/assets/routes-good.js"></body>', "https://sab-trackerai.lovable.app");
    expect(result.assets.map((url) => url.href)).toEqual(["https://sab-trackerai.lovable.app/assets/routes-good.js"]);
  });
});