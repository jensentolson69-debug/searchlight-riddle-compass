CREATE TABLE public.aa_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'script',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.aa_notes TO anon, authenticated;
GRANT ALL ON public.aa_notes TO service_role;

ALTER TABLE public.aa_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view aa_notes"
  ON public.aa_notes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert aa_notes"
  ON public.aa_notes FOR INSERT
  TO anon, authenticated
  WITH CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 1000);

CREATE POLICY "Anyone can delete aa_notes"
  ON public.aa_notes FOR DELETE
  TO anon, authenticated
  USING (true);