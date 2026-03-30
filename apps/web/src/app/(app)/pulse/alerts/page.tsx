import { listAlerts, getUnreadCount } from "@/modules/pulse/actions/alert.actions";
import AlertsClient from "./_components/alerts-client";

export const metadata = { title: "Alerts — Pulse | Cashpile" };

interface PageProps {
  searchParams: Promise<{ unread?: string }>;
}

export default async function PulseAlertsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const unreadOnly = params.unread === "1";
  const [alerts, unreadCount] = await Promise.all([
    listAlerts(unreadOnly),
    getUnreadCount(),
  ]);
  return <AlertsClient alerts={alerts} unreadCount={unreadCount} unreadOnly={unreadOnly} />;
}
