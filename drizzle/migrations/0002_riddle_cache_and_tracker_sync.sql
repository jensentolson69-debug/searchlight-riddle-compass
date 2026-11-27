CREATE TABLE public.solved_riddles (
 riddle_key text PRIMARY KEY,
 riddle text NOT NULL,
 answer text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 facts_version text NOT NULL
);
GRANT SELECT ON public.solved_riddles TO anon, authenticated;
GRANT ALL ON public.solved_riddles TO service_role;
ALTER TABLE public.solved_riddles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read confirmed riddle answers" ON public.solved_riddles FOR SELECT TO anon, authenticated USING (true);
CREATE TABLE public.tracker_snapshots (
 id text PRIMARY KEY,
 content text NOT NULL DEFAULT '',
 refreshed_at timestamptz,
 lease_until timestamptz,
 last_error text
);
GRANT SELECT ON public.tracker_snapshots TO anon, authenticated;
GRANT ALL ON public.tracker_snapshots TO service_role;
ALTER TABLE public.tracker_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read tracker snapshot" ON public.tracker_snapshots FOR SELECT TO anon, authenticated USING (true);
CREATE FUNCTION public.acquire_tracker_sync() RETURNS boolean LANGUAGE plpgsql SET search_path = public AS $$
DECLARE acquired text;
BEGIN
 INSERT INTO public.tracker_snapshots(id, lease_until) VALUES ('current', now() + interval '2 minutes')
 ON CONFLICT (id) DO UPDATE SET lease_until = EXCLUDED.lease_until
 WHERE tracker_snapshots.lease_until IS NULL OR tracker_snapshots.lease_until < now()
 RETURNING id INTO acquired;
 RETURN acquired IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.acquire_tracker_sync() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_tracker_sync() TO service_role;