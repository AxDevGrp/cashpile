import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { assertPlaidConfigured, plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from "@/lib/plaid";
import { Products, CountryCode } from "plaid";

function clampDaysRequested(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 90;
  return Math.max(30, Math.min(730, Math.floor(parsed)));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    assertPlaidConfigured();

    const body = await req.json().catch(() => ({}));
    const daysRequested = clampDaysRequested(body.days_requested);

    const origin = new URL(req.url).origin;
    const redirectUri = process.env.PLAID_REDIRECT_URI || `${origin}/plaid/oauth`;

    const request: any = {
      user: { client_user_id: user.id },
      client_name: "Cashpile",
      products: PLAID_PRODUCTS as unknown as Products[],
      country_codes: PLAID_COUNTRY_CODES as unknown as CountryCode[],
      language: "en",
      webhook: process.env.PLAID_WEBHOOK_URL || undefined,
      redirect_uri: redirectUri,
    };

    if (PLAID_PRODUCTS.includes("transactions")) {
      request.transactions = { days_requested: daysRequested };
    }

    const response = await plaidClient.linkTokenCreate(request);

    return NextResponse.json({ link_token: response.data.link_token, days_requested: daysRequested, redirect_uri: redirectUri });
  } catch (err: any) {
    console.error("[plaid/link-token]", err?.response?.data ?? err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create link token" },
      { status: 500 }
    );
  }
}
