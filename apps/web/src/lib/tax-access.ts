import { createServerSupabaseClient, createServiceRoleClient } from "@cashpile/db";
import { isTaxTestingAllowed } from "./tax-access-policy";

type TaxTestingUser = { email?: string; email_confirmed_at?: string };

export function hasTaxTestingAccess(user: TaxTestingUser | null | undefined): boolean {
  return isTaxTestingAllowed(user, process.env.CASHPILE_TAX_TESTER_EMAILS);
}

export function assertTaxTestingAccess(user: TaxTestingUser | null | undefined): void {
  if (!hasTaxTestingAccess(user)) throw new Error("This feature is not available.");
}

export async function getTaxTestingAccess(): Promise<boolean> {
  if (!process.env.CASHPILE_TAX_TESTER_EMAILS?.trim()) return false;
  const supabase = await createServerSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return !error && hasTaxTestingAccess(user);
}

export async function requireTaxTestingAccess(): Promise<void> {
  if (!await getTaxTestingAccess()) throw new Error("This feature is not available.");
}

// Background imports and agent tokens have a trusted user ID, not a cookie session.
export async function getTaxTestingAccessForUser(userId: string): Promise<boolean> {
  if (!process.env.CASHPILE_TAX_TESTER_EMAILS?.trim()) return false;
  const { data: { user }, error } = await createServiceRoleClient().auth.admin.getUserById(userId);
  return !error && hasTaxTestingAccess(user);
}
