import Link from "next/link";
import { getCashflowSnapshot } from "@cashpile/ai";
import { PageHeader } from "@cashpile/ui";
import { getConsumerExperience } from "@/lib/consumer-experience";
import WhatIfClient from "./_components/what-if-client";

export const metadata = { title: "What if? | Cashpile" };

export default async function WhatIfPage() {
  const { userId, enabled } = await getConsumerExperience();
  if (!userId) return null;

  const snapshot = await getCashflowSnapshot(userId, 30).catch(() => null);
  const reserves = (snapshot?.accounts ?? []).filter((a) => a.role === "reserve" && a.included);
  const today = snapshot?.forecast.today ?? new Date().toISOString().slice(0, 10);

  return (
    <div className={enabled ? "px-4 sm:px-6 py-8 max-w-4xl mx-auto space-y-6" : "px-6 py-8 max-w-4xl mx-auto space-y-6"}>
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title={enabled ? "Preview a change" : "What if?"}
          description="Preview a purchase or a savings transfer before you make it. Nothing moves until you act."
        />
        <Link href="/cashflow" className="text-sm underline">← Back</Link>
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