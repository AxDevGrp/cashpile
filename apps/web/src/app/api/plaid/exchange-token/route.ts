import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@cashpile/db";
import { assertPlaidConfigured, plaidClient } from "@/lib/plaid";
import { syncPlaidItem } from "@/lib/plaid-sync";

// Map Plaid account types to Cashpile account types
function mapAccountType(type: string, subtype: string | null | undefined): string {
  if (type === "credit")     return "credit_card";
  if (subtype === "checking") return "checking";
  if (subtype === "savings")  return "savings";
  if (type === "investment")  return "investment";
  if (type === "loan")        return "loan";
  return "other";
}

async function upsertPlaidAccount(serviceClient: any, account: Record<string, any>) {
  const { data: existing, error: lookupErr } = await serviceClient
    .from("books_financial_accounts")
    .select("id")
    .eq("plaid_account_id", account.plaid_account_id)
    .maybeSingle();

  if (lookupErr) throw new Error(lookupErr.message);

  if (existing?.id) {
    const { error } = await serviceClient
      .from("books_financial_accounts")
      .update(account)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await serviceClient
    .from("books_financial_accounts")
    .insert(account);
  if (error) throw new Error(error.message);
}

function scorePlaidAccountMatch(existingAccount: any, plaidAccount: any) {
  let score = 0;
  if (existingAccount.last_four_digits && plaidAccount.mask && existingAccount.last_four_digits === plaidAccount.mask) score += 3;
  if (existingAccount.account_type && existingAccount.account_type === mapAccountType(plaidAccount.type, plaidAccount.subtype)) score += 2;
  const existingName = String(existingAccount.name ?? "").toLowerCase();
  const plaidName = String(plaidAccount.name ?? "").toLowerCase();
  if (existingName && plaidName && (existingName.includes(plaidName) || plaidName.includes(existingName))) score += 1;
  return score;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    assertPlaidConfigured();

    const { public_token, tax_entity_id, uda_id, import_options, replace_account_id } = await req.json();
    if (!public_token) return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
    const taxEntityId = tax_entity_id ?? uda_id ?? null;
    const serviceClient = createServiceRoleClient() as any;

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
    const { data: plaidItem, error: itemErr } = await serviceClient
      .from("books_plaid_items")
      .upsert({
        user_id:          user.id,
        uda_id:           taxEntityId,
        tax_entity_id:    taxEntityId,
        access_token,
        item_id,
        institution_name: institutionName,
        institution_id:   institutionId,
        import_options:   import_options ?? {},
        status:           "active",
        error_code:       null,
        updated_at:       new Date().toISOString(),
      }, { onConflict: "item_id" })
      .select()
      .single();
    if (itemErr) throw new Error(itemErr.message);

    // Get and create financial accounts
    const accountsRes = await plaidClient.accountsGet({ access_token });
    let replacedAccountId: string | null = null;
    let replacementPlaidAccountId: string | null = null;

    if (replace_account_id) {
      const { data: existingAccount, error: accountErr } = await serviceClient
        .from("books_financial_accounts")
        .select("id, name, account_type, last_four_digits, tax_entity_id, uda_id")
        .eq("id", replace_account_id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (accountErr) throw new Error(accountErr.message);
      if (!existingAccount) return NextResponse.json({ error: "Account to reconnect was not found" }, { status: 404 });

      const candidates = accountsRes.data.accounts
        .map((account) => ({ account, score: scorePlaidAccountMatch(existingAccount, account) }))
        .sort((a, b) => b.score - a.score);
      const best = candidates[0];
      const second = candidates[1];

      if (!best || best.score < 3 || (second && second.score === best.score)) {
        return NextResponse.json({
          error: "Could not confidently match the reconnected Plaid account to this Cashpile account. Check the last four digits and account type, then use the regular Connect Account flow.",
        }, { status: 400 });
      }

      const acct = best.account;
      const replacementTaxEntityId = taxEntityId ?? existingAccount.tax_entity_id ?? existingAccount.uda_id ?? null;
      const { error: replaceErr } = await serviceClient
        .from("books_financial_accounts")
        .update({
          uda_id:           replacementTaxEntityId,
          tax_entity_id:    replacementTaxEntityId,
          plaid_account_id: acct.account_id,
          plaid_item_id:    plaidItem.id,
          name:             existingAccount.name ?? acct.name,
          account_type:     mapAccountType(acct.type, acct.subtype),
          institution_name: institutionName,
          last_four_digits: acct.mask,
          current_balance:  acct.balances.current ?? 0,
          is_active:        true,
          updated_at:       new Date().toISOString(),
        })
        .eq("id", existingAccount.id)
        .eq("user_id", user.id);

      if (replaceErr) throw new Error(replaceErr.message);
      replacedAccountId = existingAccount.id;
      replacementPlaidAccountId = acct.account_id;
    }

    for (const acct of accountsRes.data.accounts) {
      if (replacementPlaidAccountId && acct.account_id === replacementPlaidAccountId) continue;
      await upsertPlaidAccount(serviceClient, {
        user_id:          user.id,
        uda_id:           taxEntityId,
        tax_entity_id:    taxEntityId,
        plaid_account_id: acct.account_id,
        plaid_item_id:    plaidItem.id,
        name:             acct.name,
        account_type:     mapAccountType(acct.type, acct.subtype),
        institution_name: institutionName,
        last_four_digits: acct.mask,
        current_balance:  acct.balances.current ?? 0,
        is_active:        true,
        updated_at:       new Date().toISOString(),
      });
    }

    // Trigger initial sync directly so the user's auth cookies are not required
    const syncResult = await syncPlaidItem(item_id, serviceClient);

    return NextResponse.json({ success: true, institution: institutionName, sync: syncResult, replaced_account_id: replacedAccountId });
  } catch (err: any) {
    console.error("[plaid/exchange-token]", err?.response?.data ?? err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to connect account" },
      { status: 500 }
    );
  }
}
