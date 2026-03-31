-- ============================================================================
-- CASHPILE — Migration 005: AI Credit System
-- Subscription floor + prepaid topup credits for AI usage gating
-- ============================================================================

-- ── Credit balances (one row per user) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_credit_balances (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    subscription_credits BIGINT NOT NULL DEFAULT 0,
    topup_credits BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ai_credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_credit_balances_select_own"
    ON public.ai_credit_balances FOR SELECT USING (auth.uid() = user_id);

-- ── Credit ledger (append-only audit log) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('subscription_grant', 'topup_grant', 'ai_deduction')),
    amount BIGINT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX ai_credit_ledger_user_id_idx ON public.ai_credit_ledger (user_id, created_at DESC);

ALTER TABLE public.ai_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_credit_ledger_select_own"
    ON public.ai_credit_ledger FOR SELECT USING (auth.uid() = user_id);

-- ── Atomic deduction function ────────────────────────────────────────────────
-- Depletes subscription_credits first, then topup_credits.
-- Returns false if total balance is insufficient (hard block).

CREATE OR REPLACE FUNCTION public.deduct_ai_credits(
    p_user_id UUID,
    p_amount BIGINT,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sub_credits BIGINT;
    v_topup_credits BIGINT;
    v_total BIGINT;
    v_sub_deduct BIGINT;
    v_topup_deduct BIGINT;
BEGIN
    -- Lock the row to prevent concurrent races
    SELECT subscription_credits, topup_credits
    INTO v_sub_credits, v_topup_credits
    FROM public.ai_credit_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    v_total := v_sub_credits + v_topup_credits;

    IF v_total < p_amount THEN
        RETURN FALSE;
    END IF;

    -- Deplete subscription credits first
    v_sub_deduct := LEAST(p_amount, v_sub_credits);
    v_topup_deduct := p_amount - v_sub_deduct;

    UPDATE public.ai_credit_balances
    SET
        subscription_credits = subscription_credits - v_sub_deduct,
        topup_credits        = topup_credits - v_topup_deduct,
        updated_at           = NOW()
    WHERE user_id = p_user_id;

    -- Append to ledger
    INSERT INTO public.ai_credit_ledger (user_id, type, amount, metadata)
    VALUES (p_user_id, 'ai_deduction', p_amount, p_metadata);

    RETURN TRUE;
END;
$$;

-- ── Topup grant function ──────────────────────────────────────────────────────
-- Safely increments topup_credits without touching subscription_credits.

CREATE OR REPLACE FUNCTION public.grant_topup_credits(
    p_user_id UUID,
    p_amount BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.ai_credit_balances (user_id, subscription_credits, topup_credits)
    VALUES (p_user_id, 0, p_amount)
    ON CONFLICT (user_id)
    DO UPDATE SET
        topup_credits = public.ai_credit_balances.topup_credits + EXCLUDED.topup_credits,
        updated_at    = NOW();
END;
$$;

-- ── Update handle_new_user to provision credits for free tier ─────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');

    INSERT INTO public.subscriptions (user_id, plan)
    VALUES (NEW.id, 'free');

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);

    -- Free tier: grant books access by default
    INSERT INTO public.module_access (user_id, module)
    VALUES (NEW.id, 'books');

    -- Free tier: provision AI credits (50,000 micro-dollars)
    INSERT INTO public.ai_credit_balances (user_id, subscription_credits, topup_credits)
    VALUES (NEW.id, 50000, 0);

    INSERT INTO public.ai_credit_ledger (user_id, type, amount, metadata)
    VALUES (NEW.id, 'subscription_grant', 50000, '{"plan": "free", "reason": "signup"}'::jsonb);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
