-- ============================================================================
-- CASHPILE — Migration 003: Trades Module
-- Prop firm trade tracking tables (greenfield)
-- ============================================================================

-- ── Prop Firm Accounts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trades_prop_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    firm_name TEXT NOT NULL,
    account_label TEXT,
    account_size DECIMAL(14, 2) NOT NULL,
    starting_balance DECIMAL(14, 2) NOT NULL,
    current_balance DECIMAL(14, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    -- Funded account rules
    max_daily_drawdown_pct DECIMAL(5, 2) NOT NULL DEFAULT 3.00,
    max_total_drawdown_pct DECIMAL(5, 2) NOT NULL DEFAULT 10.00,
    profit_target_pct DECIMAL(5, 2),
    trailing_drawdown BOOLEAN DEFAULT false,
    -- Status
    status TEXT CHECK (status IN ('evaluation', 'funded', 'breached', 'passed', 'inactive')) DEFAULT 'evaluation',
    funded_rules JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.trades_prop_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades_prop_accounts_select_own" ON public.trades_prop_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trades_prop_accounts_insert_own" ON public.trades_prop_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trades_prop_accounts_update_own" ON public.trades_prop_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trades_prop_accounts_delete_own" ON public.trades_prop_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_trades_prop_accounts_updated_at BEFORE UPDATE ON public.trades_prop_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── Trade Entries ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trades_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.trades_prop_accounts(id) ON DELETE CASCADE,
    instrument TEXT NOT NULL,
    direction TEXT CHECK (direction IN ('long', 'short')) NOT NULL,
    entry_price DECIMAL(14, 6) NOT NULL,
    exit_price DECIMAL(14, 6),
    size DECIMAL(14, 4) NOT NULL,
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL,
    exit_time TIMESTAMP WITH TIME ZONE,
    -- Computed / stored fields
    gross_pnl DECIMAL(14, 2),
    commissions DECIMAL(14, 2) DEFAULT 0,
    net_pnl DECIMAL(14, 2),
    r_multiple DECIMAL(8, 4),
    initial_stop DECIMAL(14, 6),
    -- Metadata
    setup_tag TEXT,
    notes TEXT,
    screenshots JSONB DEFAULT '[]'::jsonb,
    tags TEXT[] DEFAULT '{}',
    is_open BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.trades_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades_entries_select_own" ON public.trades_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trades_entries_insert_own" ON public.trades_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trades_entries_update_own" ON public.trades_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trades_entries_delete_own" ON public.trades_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_trades_entries_updated_at BEFORE UPDATE ON public.trades_entries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_trades_entries_user ON public.trades_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_entries_account ON public.trades_entries(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_entries_date ON public.trades_entries(entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_entries_instrument ON public.trades_entries(user_id, instrument);
CREATE INDEX IF NOT EXISTS idx_trades_entries_setup ON public.trades_entries(user_id, setup_tag);

-- ── Trading Sessions ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.trades_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES public.trades_prop_accounts(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    opening_balance DECIMAL(14, 2) NOT NULL,
    closing_balance DECIMAL(14, 2),
    daily_pnl DECIMAL(14, 2),
    drawdown_pct DECIMAL(8, 4),
    trade_count INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id, session_date)
);

ALTER TABLE public.trades_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trades_sessions_select_own" ON public.trades_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "trades_sessions_insert_own" ON public.trades_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "trades_sessions_update_own" ON public.trades_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "trades_sessions_delete_own" ON public.trades_sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_trades_sessions_updated_at BEFORE UPDATE ON public.trades_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_trades_sessions_account ON public.trades_sessions(account_id, session_date DESC);
