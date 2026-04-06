import { createServerSupabaseClient } from "@cashpile/db";
import { listTaxEntities } from "@/modules/books/actions/entity.actions";
import { ReportService } from "@/modules/books/services/report.service";
import ReportsClient from "./_components/reports-client";

export const metadata = { title: "Reports — Books | Cashpile" };

function getCurrentYear() {
  return new Date().getFullYear();
}

function getYearRange(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { entityId?: string; year?: string };
}) {
  const taxEntities = await listTaxEntities();
  const entityId = searchParams.entityId ?? taxEntities[0]?.id;
  const year = parseInt(searchParams.year ?? String(getCurrentYear()));

  if (!entityId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No Tax Entities found. <a href="/books/entities/new" className="underline">Create one</a> to see reports.</p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const service = new ReportService(supabase);
  const { from, to } = getYearRange(year);

  const [pnl, cashFlow, scheduleE] = await Promise.all([
    service.getPnL("", entityId, from, to).catch(() => null),
    service.getCashFlow("", entityId, from, to).catch(() => null),
    service.getScheduleE("", entityId, year).catch(() => null),
  ]);

  return (
    <ReportsClient
      entities={taxEntities}
      selectedEntityId={entityId}
      year={year}
      pnl={pnl}
      cashFlow={cashFlow}
      scheduleE={scheduleE}
    />
  );
}
