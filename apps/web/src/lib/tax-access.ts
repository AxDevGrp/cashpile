import { createServerSupabaseClient, createServiceRoleClient } from "@cashpile/db";
import { isTaxTestingAllowed } from "./tax-access-policy";

type TaxTestingUser = { email?: string; email_confirmed_at?: string };

export function isTaxModulePublicEnabled() {
  return process.env.NEXT_PUBLIC_TAX_MODULE_ENABLED === "true" || process.env.TAX_MODULE_ENABLED === "true";
}

export function isTaxModuleDeveloper(userId: string | null | undefined) {
  if (!userId) return false;
  return (process.env.TAX_MODULE_DEV_USER_IDS ?? process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}

export function canUseTaxModule(userId: string | null | undefined) {
  return isTaxModulePublicEnabled() || isTaxModuleDeveloper(userId);
}

export async function getTaxModuleAccess() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { user, canUseTax: canUseTaxModule(user?.id) };
}

export async function requireTaxModuleAccess() {
  const { user, canUseTax } = await getTaxModuleAccess();
  if (!user) throw new Error("Unauthenticated");
  if (!canUseTax) throw new Error("Tax module is not available");
  return user;
}

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
