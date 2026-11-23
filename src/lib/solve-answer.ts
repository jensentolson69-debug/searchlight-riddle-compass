/** Normalise raw model output into a game code: UPPERCASE, only A-Z 0-9 _ -, 2–50 chars. */
export function cleanAnswer(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let answer = raw
    .trim()
    .replace(/```[a-z]*/gi, "")
    .replace(/```/g, "")
    .replace(/["'`*\s]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "");
  if (answer.length < 2 || answer.length > 50) answer = "";
  return answer || null;
}
