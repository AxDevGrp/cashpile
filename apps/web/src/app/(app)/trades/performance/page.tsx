import { createServerSupabaseClient } from "@cashpile/db";
import { PerformanceService } from "@/modules/trades/services/performance.service";
import { listPropAccounts } from "@/modules/trades/actions/account.actions";
import PerformanceClient from "./_components/performance-client";

export const metadata = { title: "Performance — Trades | Cashpile" };

interface PageProps {
  searchParams: Promise<{ accountId?: string; from?: string; to?: string }>;
}

export default async function PerformancePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const accounts = await listPropAccounts();
  const activeAccountId = params.accountId ?? accounts[0]?.id ?? null;

  if (!activeAccountId || accounts.length === 0) {
    return (
      <PerformanceClient
        accounts={accounts}
        activeAccountId={null}
        stats={null}
        equityCurve={[]}
        byInstrument={[]}
        bySetup={[]}
        from={params.from}
        to={params.to}
      />
    );
  }

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthenticated");

  const svc = new PerformanceService(supabase);

  const [stats, equityCurve, byInstrument, bySetup] = await Promise.all([
    svc.getStats(user.id, activeAccountId, params.from, params.to),
    svc.getEquityCurve(user.id, activeAccountId),
    svc.getPnlByInstrument(user.id, activeAccountId),
    svc.getPnlBySetup(user.id, activeAccountId),
  ]);

  return (
    <PerformanceClient
      accounts={accounts}
      activeAccountId={activeAccountId}
      stats={stats}
      equityCurve={equityCurve}
      byInstrument={byInstrument}
      bySetup={bySetup}
      from={params.from}
      to={params.to}
    />
  );
}
