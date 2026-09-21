import Link from "next/link";
import { createServerSupabaseClient } from "@cashpile/db";
import { getCashflowSnapshot } from "@cashpile/ai";
import { PageHeader } from "@cashpile/ui";
import WhatIfClient from "./_components/what-if-client";

export const metadata = { title: "What if? | Cashpile" };

export default async function WhatIfPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const snapshot = await getCashflowSnapshot(user.id, 30).catch(() => null);
  const reserves = (snapshot?.accounts ?? []).filter((a) => a.role === "reserve" && a.included);
  const today = snapshot?.forecast.today ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="What if?"
          description="Preview a purchase or a savings transfer before you make it. Nothing moves until you act."
        />
        <Link href="/cashflow" className="text-sm text-primary">← Back</Link>
      </div>
      {!snapshot ? (
        <div className="glass-card rounded-2xl p-6 text-sm text-muted-foreground">
          Couldn&apos;t load your cashflow data. Try again in a moment.
        </div>
      ) : (
        <WhatIfClient
          reserves={reserves.map((a) => ({ id: a.id, name: a.name, isEmergency: !!a.isEmergency }))}
          today={today}
        />
      )}
    </div>
  );
}