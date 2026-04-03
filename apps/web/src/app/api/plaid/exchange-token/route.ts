import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@cashpile/db";
import { plaidClient } from "@/lib/plaid";
import { AccountType } from "plaid";

// Map Plaid account types to Cashpile account types
function mapAccountType(type: string, subtype: string | null | undefined): string {
  if (type === "credit")     return "credit_card";
  if (subtype === "checking") return "checking";
  if (subtype === "savings")  return "savings";
  if (type === "investment")  return "investment";
  if (type === "loan")        return "loan";
  return "other";
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const { public_token, uda_id } = await req.json();
    if (!public_token) return NextResponse.json({ error: "Missing public_token" }, { status: 400 });

    // Exchange public token for access token
    const exchangeRes = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeRes.data;

    // Get institution info
    const itemRes = await plaidClient.itemGet({ access_token });
    const institutionId = itemRes.data.item.institution_id ?? null;
    let institutionName: string | null = null;
    if (institutionId) {
      const instRes = await plaidClient.institutionsGetById({
        institution_id: institutionId,
        country_codes: ["US" as any],
      });
      institutionName = instRes.data.institution.name;
    }

    // Store Plaid item
    const { data: plaidItem, error: itemErr } = await (supabase as any)
      .from("books_plaid_items")
      .insert({
        user_id:          user.id,
        uda_id:           uda_id ?? null,
        access_token,
        item_id,
        institution_name: institutionName,
        institution_id:   institutionId,
        status:           "active",
      })
      .select()
      .single();
    if (itemErr) throw new Error(itemErr.message);

    // Get and create financial accounts
    const accountsRes = await plaidClient.accountsGet({ access_token });
    for (const acct of accountsRes.data.accounts) {
      await (supabase as any)
        .from("books_financial_accounts")
        .upsert({
          uda_id:           uda_id ?? null,
          plaid_account_id: acct.account_id,
          plaid_item_id:    plaidItem.id,
          name:             acct.name,
          account_type:     mapAccountType(acct.type, acct.subtype),
          institution_name: institutionName,
          last_four_digits: acct.mask,
          current_balance:  acct.balances.current ?? 0,
          is_active:        true,
        }, { onConflict: "plaid_account_id", ignoreDuplicates: false });
    }

    // Trigger initial sync
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id }),
    });

    return NextResponse.json({ success: true, institution: institutionName });
  } catch (err: any) {
    console.error("[plaid/exchange-token]", err?.response?.data ?? err);
    return NextResponse.json({ error: "Failed to connect account" }, { status: 500 });
  }
}
