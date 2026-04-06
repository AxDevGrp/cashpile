import { listEvents } from "@/modules/pulse/actions/event.actions";
import { getUnreadCount } from "@/modules/pulse/actions/alert.actions";
import { getUserPlan } from "@/modules/pulse/actions/user.actions";
import { getUserInstruments } from "@/modules/pulse/actions/watchlist.actions";
import PulseDashboard from "./dashboard.client";
import type { Plan } from "@cashpile/db";

export const metadata = { title: "Pulse | Cashpile" };

export default async function PulsePage() {
  const [initialEvents, initialUnreadCount, userPlan, userInstruments] = await Promise.all([
    listEvents({ limit: 10 }).catch(() => []),
    getUnreadCount().catch(() => 0),
    getUserPlan().catch(() => "free" as Plan),
    getUserInstruments().catch(() => []),
  ]);

  return (
    <PulseDashboard
      initialEvents={initialEvents}
      initialUnreadCount={initialUnreadCount}
      userPlan={userPlan}
      userInstruments={userInstruments}
    />
  );
}
