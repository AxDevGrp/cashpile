import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { formatCurrency } from "@cashpile/ui";
import type { CashflowSnapshot } from "@cashpile/ai";

interface Props {
  snapshot: CashflowSnapshot;
}

export default function UntilPaydayCard({ snapshot }: Props) {
  const available = snapshot.availableUntilPayday;
  const paydayWindow = snapshot.paydayWindow;
  const dataQuality = snapshot.dataQuality;
  const forecast = snapshot.forecast;
  const hasPayday = !!paydayWindow?.nextPayday;
  const shortfall = available != null && available < 0 ? Math.abs(available) : null;

  const windowPoints = forecast.dailyBalances
    .filter((d) => !paydayWindow || d.date <= paydayWindow.end)
    .map((d) => d.projectedBalance);
  const buffer = snapshot.minimumBuffer;

  return (
    <section className="glass-card rounded-2xl p-6" aria-labelledby="until-payday-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="until-payday-heading" className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" />
            {hasPayday ? "Until payday" : "Next 14 days"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {hasPayday
              ? `Through ${paydayWindow!.end} — the day before your ${paydayWindow!.provisional ? "estimated" : "confirmed"} payday`
              : "No payday confirmed yet, so this covers the next two weeks (estimate)"}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {dataQuality?.balanceStale && (
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">
              Balances as of {dataQuality.balanceAsOf ? dataQuality.balanceAsOf.slice(0, 10) : "unknown"} — may be stale
            </span>
          )}
          {dataQuality && !dataQuality.historyComplete && (
            <span className="rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-medium">
              Based on {dataQuality.historyDays} days of data
            </span>
          )}
          {dataQuality && dataQuality.pendingCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {dataQuality.pendingCount} pending
            </span>
          )}
        </div>
      </div>

      {available == null ? (
        <div className="mt-4">
          <p className="text-2xl font-bold">No spending account in your plan</p>
          <p className="text-sm text-muted-foreground mt-1">
            Until payday is calculated from accounts marked as spending cash.{" "}
            <Link href="/cashflow" className="text-primary underline-offset-2 hover:underline">Choose your plan accounts →</Link>
          </p>
        </div>
      ) : (
        <div className="mt-3">
          {shortfall != null ? (
            <p className="text-4xl font-bold font-mono text-red-600">Projected shortfall: {formatCurrency(shortfall)}</p>
          ) : (
            <p className="text-4xl font-bold font-mono">{formatCurrency(available)}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            {shortfall != null
              ? `Bills and spending before ${paydayWindow?.end} push you below your ${formatCurrency(buffer)} buffer.`
              : `Left to spend before ${paydayWindow?.end} without dipping below your ${formatCurrency(buffer)} buffer.`}
          </p>
        </div>
      )}

      {windowPoints.length > 1 && (
        <div className="mt-4" aria-label={sparklineLabel(windowPoints, forecast.projectedLowDate ?? "", buffer)}>
          <svg viewBox={`0 0 ${windowPoints.length - 1} 40`} preserveAspectRatio="none" className="h-16 w-full" role="img">
            <polyline
              points={sparklinePoints(windowPoints)}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              className="text-emerald-600"
              strokeDasharray="1 0.6"
              vectorEffect="non-scaling-stroke"
            />
            <circle cx="0" cy={40 - scale(windowPoints[0], windowPoints)} r="1.2" className="fill-emerald-600" />
          </svg>
          <p className="text-[11px] text-muted-foreground">
            Projected balance (dashed) — low of {formatCurrency(forecast.projectedLowBalance)} on {forecast.projectedLowDate}.
          </p>
        </div>
      )}

      <details className="mt-4 group">
        <summary className="text-sm font-medium text-primary cursor-pointer select-none">Why this number?</summary>
        <div className="mt-2 text-sm text-muted-foreground space-y-2">
          <ul className="list-disc pl-5 space-y-1">
            <li>Spendable cash now: {formatCurrency(forecast.currentSpendableBalance)}</li>
            <li>
              Lowest projected balance before {paydayWindow?.end}: {formatCurrency(forecast.projectedLowBalance)}
              {forecast.projectedLowDate ? ` on ${forecast.projectedLowDate}` : ""}
            </li>
            <li>Your minimum buffer: {formatCurrency(buffer)}</li>
            <li>
              {shortfall != null
                ? "The projected low sits below the buffer, so the shortfall is shown instead of $0."
                : "Buffer subtracted from the projected low leaves the amount above."}
            </li>
          </ul>
          {dataQuality && (
            <ul className="list-disc pl-5 space-y-1">
              <li>Accounts in your plan: {dataQuality.accountsIncluded} ({dataQuality.accountsExcluded} excluded)</li>
              {dataQuality.missingInputs.includes("essential_allowance") && (
                <li>Everyday spending allowance is not set — essentials like groceries are not yet in this forecast.</li>
              )}
              {dataQuality.missingInputs.includes("confirmed_payday") && (
                <li>No payday confirmed — the 14-day estimate is used.</li>
              )}
            </ul>
          )}
          <Link href="/cashflow" className="text-primary underline-offset-2 hover:underline inline-block">See the next 30 days →</Link>
        </div>
      </details>
    </section>
  );
}

function scale(value: number, points: number[]): number {
  const min = Math.min(...points);
  const max = Math.max(...points);
  if (max === min) return 20;
  return 2 + ((value - min) / (max - min)) * 36;
}

function sparklinePoints(points: number[]): string {
  return points.map((value, i) => `${i},${40 - scale(value, points)}`).join(" ");
}

function sparklineLabel(points: number[], lowDate: string, _buffer: number): string {
  const first = points[0] ?? 0;
  const last = points[points.length - 1] ?? 0;
  const min = Math.min(...points);
  const max = Math.max(...points);
  return `Projected daily balance: starts at ${formatCurrency(first)}, ranges from ${formatCurrency(min)} to ${formatCurrency(max)}, ends at ${formatCurrency(last)}. Lowest point on ${lowDate}.`;
}