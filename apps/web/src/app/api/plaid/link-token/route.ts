import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { plaidClient, PLAID_PRODUCTS, PLAID_COUNTRY_CODES } from "@/lib/plaid";
import { Products, CountryCode } from "plaid";

export async function POST(_req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "Cashpile",
      products: PLAID_PRODUCTS as unknown as Products[],
      country_codes: PLAID_COUNTRY_CODES as unknown as CountryCode[],
      language: "en",
      webhook: process.env.PLAID_WEBHOOK_URL,
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err: any) {
    console.error("[plaid/link-token]", err?.response?.data ?? err);
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
