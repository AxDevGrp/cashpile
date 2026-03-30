-- ============================================================================
-- CASHPILE — Migration 004: Pulse Module
-- Market intelligence and MiroFish prediction tables (greenfield)
-- ============================================================================

-- ── Pulse Events ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pulse_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,
    category TEXT NOT NULL CHECK (category IN ('fed', 'macro', 'geopolitical', 'earnings', 'sector', 'commodities')),
    source TEXT NOT NULL,
    source_url TEXT,
    raw_content TEXT,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    affected_instruments JSONB DEFAULT '[]'::jsonb,
    published_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ingested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    dedup_hash TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pulse events are system-generated, public read for authenticated users
ALTER TABLE public.pulse_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pulse_events_select_auth" ON public.pulse_events FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pulse_events_category ON public.pulse_events(category);
CREATE INDEX IF NOT EXISTS idx_pulse_events_severity ON public.pulse_events(severity);
CREATE INDEX IF NOT EXISTS idx_pulse_events_published ON public.pulse_events(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_events_dedup ON public.pulse_events(dedup_hash);

-- ── Pulse Predictions (MiroFish results) ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pulse_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.pulse_events(id) ON DELETE CASCADE,
    mirofish_job_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'complete', 'failed')) DEFAULT 'pending',
    report_json JSONB,
    instrument_impacts JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    simulation_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.pulse_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pulse_predictions_select_auth" ON public.pulse_predictions FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_pulse_predictions_event ON public.pulse_predictions(event_id);
CREATE INDEX IF NOT EXISTS idx_pulse_predictions_status ON public.pulse_predictions(status);
CREATE INDEX IF NOT EXISTS idx_pulse_predictions_job ON public.pulse_predictions(mirofish_job_id);

-- ── User Watchlist ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pulse_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    instrument TEXT NOT NULL,
    alert_threshold_pct DECIMAL(6, 2) DEFAULT 1.00,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, instrument)
);

ALTER TABLE public.pulse_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pulse_watchlist_select_own" ON public.pulse_watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pulse_watchlist_insert_own" ON public.pulse_watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pulse_watchlist_update_own" ON public.pulse_watchlist FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pulse_watchlist_delete_own" ON public.pulse_watchlist FOR DELETE USING (auth.uid() = user_id);

-- ── User Alerts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pulse_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.pulse_events(id) ON DELETE CASCADE,
    prediction_id UUID REFERENCES public.pulse_predictions(id) ON DELETE CASCADE,
    instrument TEXT,
    message TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'info',
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.pulse_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pulse_alerts_select_own" ON public.pulse_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "pulse_alerts_update_own" ON public.pulse_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "pulse_alerts_insert_system" ON public.pulse_alerts FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pulse_alerts_user ON public.pulse_alerts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pulse_alerts_unread ON public.pulse_alerts(user_id, read_at) WHERE read_at IS NULL;
