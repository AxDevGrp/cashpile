-- ============================================================================
-- CASHPILE — Migration 025: Reversible feature flags
-- Release gating for the decision-first experience. Reads are open to any
-- authenticated user; only the service role / SQL editor can write, so the
-- flag flips with one SQL statement and nothing in the app can change it.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  cohorts UUID[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read feature flags"
  ON public.app_feature_flags
  FOR SELECT
  TO authenticated
  USING (true);

INSERT INTO public.app_feature_flags (key, enabled, cohorts)
VALUES ('decision_first_experience', false, '{}')
ON CONFLICT (key) DO NOTHING;