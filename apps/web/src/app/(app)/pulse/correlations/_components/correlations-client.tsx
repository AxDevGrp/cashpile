"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { PageHeader } from "@cashpile/ui";
import type { CorrelationCell, EventCategory } from "@/modules/pulse/types";

interface Props {
  grid: CorrelationCell[];
  selectedInstruments: string[];
  defaultInstruments: string[];
  watchlistInstruments: string[];
  days: number;
}

const CATEGORIES: EventCategory[] = [
  "fed",
  "macro",
  "geopolitical",
  "earnings",
  "sector",
  "commodities",
];

function getCellColor(netScore: number, total: number): string {
  if (total === 0) return "bg-muted/30 text-muted-foreground";
  if (netScore >= 3) return "bg-green-500 text-white";
  if (netScore >= 1) return "bg-green-200 text-green-900 dark:bg-green-900/40 dark:text-green-300";
  if (netScore <= -3) return "bg-red-500 text-white";
  if (netScore <= -1) return "bg-red-200 text-red-900 dark:bg-red-900/40 dark:text-red-300";
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
}

function getCell(
  grid: CorrelationCell[],
  instrument: string,
  category: EventCategory
): CorrelationCell {
  return (
    grid.find((c) => c.instrument === instrument && c.category === category) ?? {
      instrument,
      category,
      bullish_count: 0,
      bearish_count: 0,
      neutral_count: 0,
      net_score: 0,
    }
  );
}

export default function CorrelationsClient({
  grid,
  selectedInstruments,
  defaultInstruments,
  watchlistInstruments,
  days,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setDays(d: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", String(d));
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleInstrument(inst: string) {
    const current = new Set(selectedInstruments);
    if (current.has(inst)) current.delete(inst);
    else current.add(inst);
    const params = new URLSearchParams(searchParams.toString());
    params.set("instruments", [...current].join(","));
    router.push(`${pathname}?${params.toString()}`);
  }

  const allInstruments = [...new Set([...defaultInstruments, ...watchlistInstruments])];
  const hasData = grid.some((c) => c.bullish_count + c.bearish_count + c.neutral_count > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market Correlations"
        description="How each event category historically impacts your instruments"
      />

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-start">
        <div>
          <p className="text-xs text-muted-foreground mb-2">Instruments</p>
          <div className="flex flex-wrap gap-1.5">
            {allInstruments.map((inst) => {
              const active = selectedInstruments.includes(inst);
              return (
                <button
                  key={inst}
                  onClick={() => toggleInstrument(inst)}
                  className={`text-xs px-2 py-1 rounded font-mono border transition-colors ${
                    active
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-background text-muted-foreground border-muted-foreground/30 hover:border-violet-400"
                  }`}
                >
                  {inst}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">Lookback</p>
          <div className="flex gap-1.5">
            {[7, 14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  days === d
                    ? "bg-violet-600 text-white border-violet-600"
                    : "bg-background text-muted-foreground border-muted-foreground/30 hover:border-violet-400"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p className="font-medium">No prediction data yet</p>
          <p className="text-sm mt-1">
            Correlations will appear once MiroFish simulations complete for ingested events.
          </p>
        </div>
      ) : selectedInstruments.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-muted-foreground text-sm">
          Select at least one instrument to view correlations.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left w-20">Instrument</th>
                {CATEGORIES.map((c) => (
                  <th key={c} className="px-3 py-2 text-center capitalize">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedInstruments.map((inst) => (
                <tr key={inst} className="border-b last:border-0">
                  <td className="px-4 py-2 font-mono font-semibold text-xs">{inst}</td>
                  {CATEGORIES.map((cat) => {
                    const cell = getCell(grid, inst, cat);
                    const total = cell.bullish_count + cell.bearish_count + cell.neutral_count;
                    const colorClass = getCellColor(cell.net_score, total);
                    return (
                      <td key={cat} className="px-3 py-2 text-center">
                        <div
                          className={`rounded px-2 py-1 text-xs font-medium ${colorClass}`}
                          title={`↑${cell.bullish_count} ↓${cell.bearish_count} =${cell.neutral_count}`}
                        >
                          {total === 0 ? "—" : cell.net_score > 0 ? `+${cell.net_score}` : cell.net_score}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Net score = bullish signals − bearish signals from MiroFish predictions.
        Green = net bullish, Red = net bearish. Hover cells for raw counts.
      </p>
    </div>
  );
}
