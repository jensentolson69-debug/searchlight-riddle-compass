// Server-only helpers for storing and reading live Admin Abuse notes from Sammy.
export type AaNote = {
  id: string;
  content: string;
  source: string;
  created_at: string;
};

const MAX_NOTES_IN_PROMPT = 50;

async function getAdmin() {
  if (!process.env["SUPABASE_URL"] && !process.env["VITE_SUPABASE_URL"]) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function listAaNotes(limit = MAX_NOTES_IN_PROMPT): Promise<AaNote[]> {
  const admin = await getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("aa_notes")
    .select("id, content, source, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("aa_notes list error", error.message);
    return [];
  }
  return (data ?? []) as AaNote[];
}

export async function addAaNote(content: string, source = "script"): Promise<AaNote | null> {
  const admin = await getAdmin();
  if (!admin) return null;
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 1000) return null;
  const cleanSource = source === "manual" ? "manual" : "script";
  const { data, error } = await admin
    .from("aa_notes")
    .insert({ content: trimmed, source: cleanSource })
    .select("id, content, source, created_at")
    .single();
  if (error) {
    console.error("aa_notes insert error", error.message);
    return null;
  }
  return data as AaNote;
}

export async function deleteAaNote(id: string): Promise<boolean> {
  const admin = await getAdmin();
  if (!admin) return false;
  const { error } = await admin.from("aa_notes").delete().eq("id", id);
  return !error;
}

export async function clearAaNotes(): Promise<boolean> {
  const admin = await getAdmin();
  if (!admin) return false;
  const { error } = await admin.from("aa_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  return !error;
}

/** Formats recent Admin Abuse notes for the riddle solver prompt. Returns "" when none exist. */
export async function loadAaNotesText(): Promise<string> {
  try {
    const notes = await listAaNotes(MAX_NOTES_IN_PROMPT);
    if (notes.length === 0) return "";
    return notes.map((n) => `- ${n.content}`).join("\n");
  } catch {
    return "";
  }
}