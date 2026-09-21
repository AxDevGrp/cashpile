type TaxTestingUser = { email?: string; email_confirmed_at?: string };

export function isTaxTestingAllowed(user: TaxTestingUser | null | undefined, testerEmails: string | undefined): boolean {
  if (!user?.email || !user.email_confirmed_at) return false;
  const email = user.email.trim().toLowerCase();
  return (testerEmails ?? "").split(",").some((entry) => entry.trim().toLowerCase() === email);
}

export function isTaxTestingPath(pathname: string): boolean {
  return ["/books/tax", "/books/entities", "/books/reports", "/api/tax"].some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}
