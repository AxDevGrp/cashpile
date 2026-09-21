import { createServerSupabaseClient } from "@cashpile/db";

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
