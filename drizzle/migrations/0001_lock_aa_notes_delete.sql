DROP POLICY IF EXISTS "Anyone can delete aa_notes" ON public.aa_notes;
REVOKE DELETE ON public.aa_notes FROM anon, authenticated;