-- ============================================================================
-- CASHPILE — Migration 010: Agentic Layer
-- External agent connections, scoped permissions, confirmation/audit support.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agent_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS public.agent_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    agent_connection_id UUID REFERENCES public.agent_connections(id) ON DELETE SET NULL,
    agent_name TEXT,
    capability TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('preview', 'success', 'error')),
    request_id TEXT,
    input JSONB,
    result JSONB,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_confirmation_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    agent_connection_id UUID REFERENCES public.agent_connections(id) ON DELETE SET NULL,
    capability TEXT NOT NULL,
    input JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'previewed' CHECK (status IN ('previewed', 'executed', 'expired', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    executed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.agent_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_confirmation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_connections_select_own" ON public.agent_connections
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "agent_connections_update_own" ON public.agent_connections
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "agent_audit_logs_select_own" ON public.agent_audit_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "agent_confirmation_events_select_own" ON public.agent_confirmation_events
    FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_agent_connections_user_id ON public.agent_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_connections_token_hash ON public.agent_connections(token_hash);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_user_id_created_at ON public.agent_audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_audit_logs_capability ON public.agent_audit_logs(capability);
CREATE INDEX IF NOT EXISTS idx_agent_confirmation_events_user_id_created_at ON public.agent_confirmation_events(user_id, created_at DESC);
