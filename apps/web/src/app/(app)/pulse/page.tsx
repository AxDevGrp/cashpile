import { listEvents } from "@/modules/pulse/actions/event.actions";
import { getUnreadCount } from "@/modules/pulse/actions/alert.actions";
import { getUserPlan } from "@/modules/pulse/actions/user.actions";
import { getUserInstruments } from "@/modules/pulse/actions/watchlist.actions";
import PulseDashboard from "./dashboard.client";
import type { Plan } from "@cashpile/db";
import { ModuleHomeV2 } from "../_components/module-home-v2";
import { isUiV2Enabled } from "@/components/ui-v2";
import { shouldRenderModuleEntrance } from "@/components/ui-v2/module-home-model";

export const metadata = { title: "Pulse | Cashpile" };

export default async function PulsePage({ searchParams }: { searchParams?: Promise<{ view?: string }> }) {
  const [initialEvents, initialUnreadCount, userPlan, userInstruments] = await Promise.all([
    listEvents({ limit: 10 }).catch(() => []),
    getUnreadCount().catch(() => 0),
    getUserPlan().catch(() => "free" as Plan),
    getUserInstruments().catch(() => []),
  ]);
  const resolvedSearchParams = await searchParams;
  const insight = initialUnreadCount > 0
    ? { id: "alerts", severity: "attention" as const, title: `${initialUnreadCount.toLocaleString()} unread alert${initialUnreadCount === 1 ? "" : "s"}`, detail: "Review the latest market signals.", actionLabel: "Open alerts" }
    : initialEvents.length > 0
      ? { id: "events", severity: "info" as const, title: `${initialEvents.length.toLocaleString()} recent event${initialEvents.length === 1 ? "" : "s"}`, detail: "Pulse has fresh signals to review.", actionLabel: "Open events" }
      : { id: "pulse-calm", severity: "info" as const, title: "Pulse is calm", detail: userPlan === "free" ? "Your plan is ready when you want more signals." : "No new events need your attention." };
  if (shouldRenderModuleEntrance(isUiV2Enabled(), resolvedSearchParams?.view)) return <ModuleHomeV2 id="pulse" insight={insight} actionHref={initialUnreadCount > 0 ? "/pulse/alerts" : initialEvents.length > 0 ? "/pulse/events" : "/pulse?view=details"} />;

  return (
    <PulseDashboard
      initialEvents={initialEvents}
      initialUnreadCount={initialUnreadCount}
      userPlan={userPlan}
      userInstruments={userInstruments}
    />
  );
}
