-- ============================================================================
-- CASHPILE — Migration 029: Consumer agent controls (Stage 08)
--   * agent_rate_windows + atomic per-owner/capability/minute consume RPC
--   * bounded retention purge
--   * agent_connections: remove broad authenticated UPDATE policy
--   * consumer_create_agent / consumer_revoke_agent security-definer RPCs
-- Depends on 010 (agent_connections) and 027 (consumer_raise).
-- No production application here.
-- ============================================================================

-- ── Rate windows (service-only) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.agent_rate_windows (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  capability TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  PRIMARY KEY (user_id, capability, window_start)
);

CREATE INDEX IF NOT EXISTS idx_agent_rate_windows_start
  ON public.agent_rate_windows(window_start);

ALTER TABLE public.agent_rate_windows ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_rate_windows FROM PUBLIC;

-- Atomic increment or reject. Returns NULL when allowed; otherwise the number
-- of seconds until the next minute bucket. A rejected request never increments
-- past the limit.
CREATE OR REPLACE FUNCTION public.consume_agent_rate(
  p_user_id UUID,
  p_capability TEXT,
  p_limit INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_window TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_capability IS NULL OR btrim(p_capability) = '' THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 120 THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;

  v_window := date_trunc('minute', now());

  INSERT INTO public.agent_rate_windows (user_id, capability, window_start, request_count)
  VALUES (p_user_id, p_capability, v_window, 1)
  ON CONFLICT (user_id, capability, window_start)
  DO UPDATE SET request_count = public.agent_rate_windows.request_count + 1
    WHERE public.agent_rate_windows.request_count < p_limit
  RETURNING request_count INTO v_count;

  IF NOT FOUND THEN
    RETURN GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (v_window + interval '1 minute' - now())))::integer
    );
  END IF;

  RETURN NULL;
END;
$$;

-- Bounded retention: delete buckets older than the window (default 24h).
CREATE OR REPLACE FUNCTION public.purge_agent_rate_windows(p_older_than INTERVAL DEFAULT interval '24 hours')
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF p_older_than IS NULL OR p_older_than < interval '1 minute' THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;
  WITH gone AS (
    DELETE FROM public.agent_rate_windows
    WHERE window_start < now() - p_older_than
    RETURNING 1
  )
  SELECT count(*) INTO v_deleted FROM gone;
  RETURN v_deleted;
END;
$$;

-- ── Connection control RPCs ─────────────────────────────────────────────────

-- Remove the broad authenticated UPDATE policy: token_hash, scopes and status
-- can no longer be changed through generic Data API writes.
DROP POLICY IF EXISTS "agent_connections_update_own" ON public.agent_connections;

-- Create a consumer connection. Caller identity comes only from the session;
-- scopes are fixed server-side and the active count is capped atomically under
-- a per-owner advisory lock.
CREATE OR REPLACE FUNCTION public.consumer_create_agent(p_name TEXT, p_token_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_id UUID;
  v_active INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    PERFORM public.consumer_raise('not_found');
  END IF;
  IF char_length(v_name) < 1 OR char_length(v_name) > 80 THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;
  IF p_token_hash IS NULL OR p_token_hash !~ '^[0-9a-f]{64}$' THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('agent_connections:' || v_uid::text, 0));

  SELECT count(*) INTO v_active
  FROM public.agent_connections
  WHERE user_id = v_uid AND status = 'active';

  IF v_active >= 10 THEN
    PERFORM public.consumer_raise('limit_reached');
  END IF;

  INSERT INTO public.agent_connections (user_id, agent_name, token_hash, scopes, status)
  VALUES (v_uid, v_name, p_token_hash, '["cashboard:read"]'::jsonb, 'active')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Revoke an owned connection. Idempotent for an already-revoked owned row;
-- foreign or nonexistent ids raise not_found.
CREATE OR REPLACE FUNCTION public.consumer_revoke_agent(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    PERFORM public.consumer_raise('not_found');
  END IF;
  IF p_id IS NULL THEN
    PERFORM public.consumer_raise('invalid_input');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.agent_connections WHERE id = p_id AND user_id = v_uid
  ) THEN
    PERFORM public.consumer_raise('not_found');
  END IF;

  UPDATE public.agent_connections
  SET status = 'revoked', revoked_at = now()
  WHERE id = p_id AND user_id = v_uid AND status = 'active';

  INSERT INTO public.agent_audit_logs
    (user_id, agent_connection_id, capability, kind, status, input)
  VALUES
    (v_uid, p_id, 'agent.connections.revoke', 'write', 'success', '{}'::jsonb);
END;
$$;

-- ── Grants ──────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.consume_agent_rate(UUID, TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.purge_agent_rate_windows(INTERVAL) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_create_agent(TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.consumer_revoke_agent(UUID) FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consume_agent_rate(UUID, TEXT, INTEGER) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.purge_agent_rate_windows(INTERVAL) TO service_role';
    EXECUTE 'GRANT ALL ON public.agent_rate_windows TO service_role';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_create_agent(TEXT, TEXT) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_revoke_agent(UUID) TO authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_create_agent(TEXT, TEXT) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.consumer_revoke_agent(UUID) TO service_role';
  END IF;
END $$;
