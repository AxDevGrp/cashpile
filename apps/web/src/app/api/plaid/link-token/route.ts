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
    const updatePlaidItemId = typeof body.update_plaid_item_id === "string" ? body.update_plaid_item_id : null;

    const origin = new URL(req.url).origin;
    const configuredRedirectUri = process.env.PLAID_REDIRECT_URI || `${origin}/plaid/oauth`;
    const redirectUri = configuredRedirectUri.startsWith("https://") ? configuredRedirectUri : undefined;
    const redirectWarning = redirectUri
      ? null
      : "Plaid production requires an HTTPS redirect URI for OAuth institutions. Localhost redirect_uri was omitted; use a hosted HTTPS URL for Chase OAuth reliability.";

    const request: any = {
      user: { client_user_id: user.id },
      client_name: "Cashpile",
      country_codes: PLAID_COUNTRY_CODES as unknown as CountryCode[],
      language: "en",
      webhook: process.env.PLAID_WEBHOOK_URL || undefined,
    };

    if (redirectUri) request.redirect_uri = redirectUri;

    if (updatePlaidItemId) {
      const { data: item, error: itemError } = await (supabase as any)
        .from("books_plaid_items")
        .select("access_token")
        .eq("id", updatePlaidItemId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (itemError) throw new Error(itemError.message);
      if (!item?.access_token) return NextResponse.json({ error: "Plaid item not found" }, { status: 404 });
      request.access_token = item.access_token;
    } else {
      request.products = PLAID_PRODUCTS as unknown as Products[];
      if (PLAID_PRODUCTS.includes("transactions")) {
        request.transactions = { days_requested: daysRequested };
      }
    }

    const response = await plaidClient.linkTokenCreate(request);

    return NextResponse.json({
      link_token: response.data.link_token,
      days_requested: daysRequested,
      redirect_uri: redirectUri ?? null,
      mode: updatePlaidItemId ? "update" : "create",
      warning: redirectWarning,
    });
  } catch (err: any) {
    console.error("[plaid/link-token]", err?.response?.data ?? err);
    const plaidError = err?.response?.data;
    const message = plaidError?.error_message ?? (err instanceof Error ? err.message : "Failed to create link token");
    return NextResponse.json(
      { error: message, plaid_error: plaidError ?? null },
      { status: 500 }
    );
  }
}
