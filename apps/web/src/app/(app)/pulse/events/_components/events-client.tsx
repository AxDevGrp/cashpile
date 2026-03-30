"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { PageHeader } from "@cashpile/ui";
import { triggerPredictionForEvent } from "@/modules/pulse/actions/event.actions";
import type { PulseEvent, EventCategory, EventSeverity } from "@/modules/pulse/types";

interface Props {
  events: PulseEvent[];
  filters: {
    category?: string;
    severity?: string;
    from?: string;
    to?: string;
    instrument?: string;
  };
}

const CATEGORY_LABELS: Record<EventCategory, string> = {
  fed: "Fed",
  macro: "Macro",
  geopolitical: "Geopolitical",
  earnings: "Earnings",
  sector: "Sector",
  commodities: "Commodities",
};

const CATEGORY_COLORS: Record<EventCategory, string> = {
  fed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  macro: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  geopolitical: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  earnings: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  sector: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  commodities: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

const SEVERITY_COLORS: Record<EventSeverity, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-yellow-100 text-yellow-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return `${Math.floor(diff / 60_000)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function EventsClient({ events, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  function navigate(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  }

  async function handlePredict(eventId: string) {
    setTriggeringId(eventId);
    startTransition(async () => {
      try {
        await triggerPredictionForEvent(eventId);
      } finally {
        setTriggeringId(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market Events"
        description="Global financial events ingested from Reuters, Yahoo Finance & Investing.com"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Category</label>
          <select
            value={filters.category ?? ""}
            onChange={(e) => navigate("category", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All categories</option>
            {(Object.keys(CATEGORY_LABELS) as EventCategory[]).map((c) => (
              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Severity</label>
          <select
            value={filters.severity ?? ""}
            onChange={(e) => navigate("severity", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">All severities</option>
            {["critical", "high", "medium", "low"].map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">Instrument</label>
          <input
            type="text"
            placeholder="ES, CL, GC…"
            defaultValue={filters.instrument ?? ""}
            onBlur={(e) => navigate("instrument", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm w-28"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <input
            type="date"
            defaultValue={filters.from ?? ""}
            onBlur={(e) => navigate("from", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <input
            type="date"
            defaultValue={filters.to ?? ""}
            onBlur={(e) => navigate("to", e.target.value)}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          />
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p className="font-medium">No events found</p>
          <p className="text-sm mt-1">Events are ingested automatically every 15 minutes via the scheduled cron.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <div
              key={event.id}
              className={`rounded-xl border bg-card p-4 flex flex-col gap-3 ${
                event.severity === "critical" ? "border-red-300 dark:border-red-700" :
                event.severity === "high" ? "border-orange-200 dark:border-orange-800" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[event.category]}`}>
                  {CATEGORY_LABELS[event.category]}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SEVERITY_COLORS[event.severity]}`}>
                  {event.severity.toUpperCase()}
                </span>
              </div>

              <div>
                <p className="font-semibold text-sm leading-snug">{event.title}</p>
                {event.summary && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-3">{event.summary}</p>
                )}
              </div>

              {event.affected_instruments.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {event.affected_instruments.map((inst) => (
                    <span key={inst} className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                      {inst}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-auto pt-2 border-t">
                <span className="text-xs text-muted-foreground">
                  {event.source} · {timeAgo(event.published_at)}
                </span>
                <button
                  onClick={() => handlePredict(event.id)}
                  disabled={isPending && triggeringId === event.id}
                  className="text-xs bg-violet-600 text-white px-3 py-1 rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {triggeringId === event.id ? "Submitting…" : "Predict"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
