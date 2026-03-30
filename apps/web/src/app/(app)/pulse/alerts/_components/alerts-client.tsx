"use client";

import { useTransition } from "react";
import Link from "next/link";
import { PageHeader } from "@cashpile/ui";
import { markAlertRead, markAllRead } from "@/modules/pulse/actions/alert.actions";
import type { PulseAlert, AlertSeverity } from "@/modules/pulse/types";

interface Props {
  alerts: PulseAlert[];
  unreadCount: number;
  unreadOnly: boolean;
}

const SEVERITY_ICONS: Record<AlertSeverity, string> = {
  info: "ℹ",
  warning: "⚠",
  critical: "🔴",
};

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: "text-blue-600 dark:text-blue-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  critical: "text-red-600 dark:text-red-400",
};

function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return `${Math.floor(diff / 60_000)}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AlertsClient({ alerts, unreadCount, unreadOnly }: Props) {
  const [, startTransition] = useTransition();

  function handleMarkRead(id: string) {
    startTransition(() => markAlertRead(id));
  }

  function handleMarkAll() {
    startTransition(() => markAllRead());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description={
          unreadCount > 0
            ? `${unreadCount} unread alert${unreadCount > 1 ? "s" : ""}`
            : "All caught up"
        }
        actions={
          unreadCount > 0 ? (
            <button
              onClick={handleMarkAll}
              className="text-sm border px-3 py-1.5 rounded-md hover:bg-muted transition-colors"
            >
              Mark all read
            </button>
          ) : undefined
        }
      />

      {/* Filter toggle */}
      <div className="flex gap-2">
        <Link
          href="/pulse/alerts"
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            !unreadOnly
              ? "bg-violet-600 text-white border-violet-600"
              : "bg-background text-muted-foreground border-muted-foreground/30 hover:border-violet-400"
          }`}
        >
          All
        </Link>
        <Link
          href="/pulse/alerts?unread=1"
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
            unreadOnly
              ? "bg-violet-600 text-white border-violet-600"
              : "bg-background text-muted-foreground border-muted-foreground/30 hover:border-violet-400"
          }`}
        >
          Unread {unreadCount > 0 && `(${unreadCount})`}
        </Link>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-lg border p-12 text-center text-muted-foreground">
          <p className="font-medium">{unreadOnly ? "No unread alerts" : "No alerts yet"}</p>
          <p className="text-sm mt-1">
            Alerts are generated when MiroFish predicts significant moves in your watched instruments.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const isUnread = !alert.read_at;
            return (
              <div
                key={alert.id}
                className={`rounded-lg border p-4 flex gap-3 items-start transition-colors ${
                  isUnread ? "bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800" : "bg-card"
                }`}
              >
                {/* Severity icon */}
                <span className={`text-base mt-0.5 ${SEVERITY_COLORS[alert.severity]}`}>
                  {SEVERITY_ICONS[alert.severity]}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${isUnread ? "font-medium" : ""}`}>{alert.message}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    {alert.instrument && (
                      <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                        {alert.instrument}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">{timeAgo(alert.created_at)}</span>
                    {alert.event_id && (
                      <Link
                        href={`/pulse/events?id=${alert.event_id}`}
                        className="text-xs text-violet-600 hover:underline"
                      >
                        View event →
                      </Link>
                    )}
                  </div>
                </div>

                {/* Mark read */}
                {isUnread && (
                  <button
                    onClick={() => handleMarkRead(alert.id)}
                    className="text-xs text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                    title="Mark as read"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
