"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Sparkles, X } from "lucide-react";

export type GremmyReminder = {
  id: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  priority: "high" | "medium" | "low";
};

const DISMISSED_KEY = "cashpile-gremmy-login-reminders-dismissed";

export function GremmyReminderModal({
  reminders,
  openOnLogin,
}: {
  reminders: GremmyReminder[];
  openOnLogin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const topReminder = reminders[0];
  const hasReminders = reminders.length > 0;

  const modalTitle = useMemo(() => {
    if (!hasReminders) return "Gremmy checked the place. No fires.";
    if (topReminder.priority === "high") return "Gremmy found money chores.";
    return "Gremmy has a few smart moves for you.";
  }, [hasReminders, topReminder?.priority]);

  useEffect(() => {
    if (!openOnLogin) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (sessionStorage.getItem(DISMISSED_KEY) === today) return;
    } catch {}
    const timer = window.setTimeout(() => setOpen(true), 350);
    return () => window.clearTimeout(timer);
  }, [openOnLogin]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  function close() {
    try {
      sessionStorage.setItem(DISMISSED_KEY, new Date().toISOString().slice(0, 10));
      const url = new URL(window.location.href);
      if (url.searchParams.has("gremmy")) {
        url.searchParams.delete("gremmy");
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gremmy-reminders-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white bg-white shadow-2xl">
        <div className="absolute inset-x-0 top-0 h-36 bg-[radial-gradient(circle_at_18%_0%,rgba(24,201,154,0.25),transparent_35%),radial-gradient(circle_at_88%_0%,rgba(37,99,235,0.18),transparent_32%)]" />

        <div className="relative p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <img
              src="/assets/gremlin-v3-crop.png"
              alt="Gremmy"
              className="h-24 w-24 shrink-0 object-contain drop-shadow-xl sm:h-28 sm:w-28"
            />
            <div className="min-w-0 flex-1 pt-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-wide text-emerald-700">
                <Sparkles className="h-3.5 w-3.5" />
                Gremmy check-in
              </div>
              <h2 id="gremmy-reminders-title" className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                {modalTitle}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {hasReminders
                  ? "Before you wander off, here’s what looks worth handling next. I ranked the stuff that can clean up your books or save cash."
                  : "No major cleanup popped up from your current data. Keep accounts synced and I’ll keep sniffing for leaks."}
              </p>
            </div>
            <button
              onClick={close}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close Gremmy reminders"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {(hasReminders ? reminders : [{
              id: "clear",
              title: "You’re clear for now",
              body: "There are no obvious uncategorized piles, recurring leaks, cash crunches, or low credit-card balances to act on right now.",
              cta: "View cash flow",
              href: "/cashflow",
              priority: "low" as const,
            }]).map((reminder) => (
              <Link
                key={reminder.id}
                href={reminder.href}
                onClick={close}
                className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left transition hover:border-emerald-200 hover:bg-emerald-50/70"
              >
                <div className={
                  reminder.priority === "high"
                    ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600"
                    : reminder.priority === "medium"
                      ? "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"
                      : "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
                }>
                  {reminder.priority === "low" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-slate-950">{reminder.title}</div>
                  <div className="mt-1 text-sm leading-relaxed text-slate-600">{reminder.body}</div>
                  <div className="mt-2 inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                    {reminder.cta} <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={close}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
            >
              Later, Gremmy
            </button>
            {topReminder && (
              <Link
                href={topReminder.href}
                onClick={close}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#18c99a] px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-[#12b589]"
              >
                Do top task <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
