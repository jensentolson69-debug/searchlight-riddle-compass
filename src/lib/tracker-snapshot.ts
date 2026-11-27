import { parse } from "acorn";
import { load } from "cheerio";

type Ast = Record<string, unknown>;
function node(value: unknown): Ast | null { return value && typeof value === "object" && !Array.isArray(value) ? value as Ast : null; }

/** Decode literal data only. Never evaluate the tracker's JavaScript. */
function literal(value: unknown, depth = 0, bound: Record<string, unknown> = {}): unknown {
  const n = node(value);
  if (!n || depth > 12) return undefined;
  if (n["type"] === "Identifier" && typeof n["name"] === "string") return bound[n["name"]];
  if (n["type"] === "Literal") return n["value"];
  if (n["type"] === "TemplateLiteral" && Array.isArray(n["expressions"])) {
    const quasis = n["quasis"];
    if (!Array.isArray(quasis)) return undefined;
    const values = n["expressions"].map((e) => literal(e, depth + 1, bound));
    if (!values.every((v) => typeof v === "string" || typeof v === "number")) return undefined;
    return quasis.map((q, i) => String(node(node(q)?.["value"])?.["cooked"] ?? "") + String(values[i] ?? "")).join("");
  }
  if (n["type"] === "ArrayExpression" && Array.isArray(n["elements"])) {
    const values = n["elements"].map((e) => literal(e, depth + 1, bound));
    return values.includes(undefined) ? undefined : values;
  }
  if (n["type"] === "ObjectExpression" && Array.isArray(n["properties"])) {
    const result: Record<string, unknown> = Object.create(null);
    for (const property of n["properties"]) {
      const p = node(property);
      if (!p || p["type"] !== "Property" || p["computed"] || p["method"]) return undefined;
      const k = node(p["key"]);
      const name = k?.["name"] ?? k?.["value"];
      const v = literal(p["value"], depth + 1, bound);
      if (typeof name !== "string" || v === undefined) return undefined;
      result[name] = v;
    }
    return result;
  }
  // The website presents mutations as literal pairs mapped to {name, note}.
  // Interpret only this pure data shape, not arbitrary callbacks or JavaScript.
  if (n["type"] === "CallExpression" && Array.isArray(n["arguments"]) && n["arguments"].length === 1) {
    const callee = node(n["callee"]);
    const fn = node(n["arguments"][0]);
    const params = fn?.["params"];
    const pattern = Array.isArray(params) && params.length === 1 ? node(params[0]) : null;
    const elements = pattern?.["elements"];
    if (callee?.["type"] !== "MemberExpression" || callee["computed"] || node(callee["property"])?.["name"] !== "map"
      || fn?.["type"] !== "ArrowFunctionExpression" || node(fn["body"])?.["type"] !== "ObjectExpression"
      || pattern?.["type"] !== "ArrayPattern" || !Array.isArray(elements)
      || !elements.every((e) => node(e)?.["type"] === "Identifier")) return undefined;
    const rows = literal(callee["object"], depth + 1, bound);
    if (!Array.isArray(rows) || rows.length > 200) return undefined;
    const mapped = rows.map((row) => {
      if (!Array.isArray(row)) return undefined;
      const bindings: Record<string, unknown> = Object.create(null);
      elements.forEach((e, i) => { const name = node(e)?.["name"]; if (typeof name === "string") bindings[name] = row[i]; });
      return literal(fn["body"], depth + 1, bindings);
    });
    return mapped.includes(undefined) ? undefined : mapped;
  }
  return undefined;
}

export function extractTrackerDatabase(source: string): string | null {
  if (source.length > 2_000_000) return null;
  const tree: unknown = parse(source, { ecmaVersion: "latest", sourceType: "module" });
  let result: string | null = null;
  let budget = 150_000;
  function walk(value: unknown) {
    if (result || --budget <= 0) return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const n = node(value);
    if (!n) return;
    if (n["type"] === "VariableDeclarator") {
      const data = node(literal(n["init"]));
      if (data && Array.isArray(data["sammy"]) && Array.isArray(data["mutations"]) && Array.isArray(data["obtain"])) {
        result = JSON.stringify(data);
        return;
      }
    }
    Object.values(n).forEach(walk);
  }
  walk(tree);
  return result;
}

export function trackerPage(html: string, origin: string) {
  const $ = load(html);
  $("script,style,nav,footer").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const assets = [...html.matchAll(/(?:src|href)=["']([^"']*\/assets\/routes-[^"']+\.js)["']/g)]
    .map((m) => new URL(m[1] ?? "", origin)).filter((url) => url.origin === origin).slice(0, 2);
  return { text, assets };
}