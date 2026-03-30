"use client";

import { useState, useTransition } from "react";
import { PageHeader } from "@cashpile/ui";
import {
  addToWatchlist,
  removeFromWatchlist,
  toggleWatchlistItem,
} from "@/modules/pulse/actions/watchlist.actions";
import type { PulseWatchlistItem, PulseEvent } from "@/modules/pulse/types";

interface Props {
  watchlist: PulseWatchlistItem[];
  recentEvents: PulseEvent[];
}

export default function WatchlistClient({ watchlist, recentEvents }: Props) {
  const [, startTransition] = useTransition();
  const [instrument, setInstrument] = useState("");
  const [threshold, setThreshold] = useState("1.0");
  const [adding, setAdding] = useState(false);

  function handleAdd() {
    if (!instrument.trim()) return;
    setAdding(true);
    startTransition(async () => {
      try {
        await addToWatchlist(instrument.trim(), parseFloat(threshold) || 1.0);
        setInstrument("");
        setThreshold("1.0");
      } finally {
        setAdding(false);
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(() => removeFromWatchlist(id));
  }

  function handleToggle(id: string, current: boolean) {
    startTransition(() => toggleWatchlistItem(id, !current));
  }

  // Map instrument → recent events that mention it
  const eventsByInstrument = new Map<string, PulseEvent[]>();
  for (const item of watchlist) {
    const relevant = recentEvents
      .filter((e) => e.affected_instruments.includes(item.instrument))
      .slice(0, 3);
    eventsByInstrument.set(item.instrument, relevant);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Watchlist"
        description="Track instruments and receive prediction alerts"
      />

      {/* Add form */}
      <div className="rounded-xl border p-4 bg-card">
        <p className="text-sm font-medium mb-3">Add Instrument</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Ticker</label>
            <input
              type="text"
              placeholder="ES, CL, GC…"
              value={instrument}
              onChange={(e) => setInstrument(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="h-9 rounded-md border bg-background px-3 text-sm w-28 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Alert threshold %</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="h-9 rounded-md border bg-background px-3 text-sm w-24"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !instrument.trim()}
            className="h-9 bg-violet-600 text-white px-4 rounded-md text-sm hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p className="font-medium">No instruments watched yet</p>
          <p className="text-sm mt-1">Add a ticker above to receive AI-generated prediction alerts.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {watchlist.map((item) => {
            const events = eventsByInstrument.get(item.instrument) ?? [];
            return (
              <div
                key={item.id}
                className={`rounded-xl border bg-card p-4 ${!item.is_active ? "opacity-60" : ""}`}
              >
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-base">{item.instrument}</span>
                    <span className="text-xs text-muted-foreground">
                      Alert at ≥{item.alert_threshold_pct}% move
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        item.is_active
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {item.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggle(item.id, item.is_active)}
                      className="text-xs border px-2 py-1 rounded hover:bg-muted transition-colors"
                    >
                      {item.is_active ? "Pause" : "Resume"}
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="text-xs border border-red-200 text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                {events.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Recent events</p>
                    {events.map((e) => (
                      <div key={e.id} className="text-xs text-muted-foreground flex gap-2">
                        <span className="shrink-0 capitalize">[{e.severity}]</span>
                        <span className="line-clamp-1">{e.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
