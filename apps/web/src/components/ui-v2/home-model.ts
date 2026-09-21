import type { UiV2Insight, UiV2InsightSeverity } from "./model";

export type HomeReminder = {
  id: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  priority: "high" | "medium" | "low";
};

export type HomePriorityInsight = UiV2Insight & { actionHref: string };

const prioritySeverity: Record<HomeReminder["priority"], UiV2InsightSeverity> = {
  high: "critical",
  medium: "attention",
  low: "info",
};

export function shouldRenderAiFirstHome(flag: boolean, view?: string): boolean {
  return flag && view !== "details";
}

export function getHomeActions(canUseTax: boolean) {
  return [
    { label: "Afford it?", href: "/cashflow" },
    { label: "Subscriptions", href: "/cashflow/recurring" },
    canUseTax
      ? { label: "Tax prep", href: "/books/tax" }
      : { label: "Review books", href: "/books" },
    { label: "Modules", href: "#modules" },
  ];
}

export function getHomePriorityInsight(
  reminder?: HomeReminder,
): HomePriorityInsight {
  if (!reminder) {
    return {
      id: "all-clear",
      severity: "info",
      title: "Everything looks calm",
      detail: "Cash has no priority chores for you right now.",
      actionLabel: "View dashboard details",
      actionHref: "/cashboard?view=details",
    };
  }

  return {
    id: reminder.id,
    severity: prioritySeverity[reminder.priority],
    title: reminder.title,
    detail: reminder.body,
    actionLabel: reminder.cta,
    actionHref: reminder.href,
  };
}
