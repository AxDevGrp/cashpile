import { listAlerts, getUnreadCount } from "@/modules/pulse/actions/alert.actions";
import AlertsClient from "./_components/alerts-client";
import { isUiV2Enabled } from "@/components/ui-v2";
import { WriteWorkflowV2 } from "../../_components/write-workflow-v2";

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
  const content = <AlertsClient alerts={alerts} unreadCount={unreadCount} unreadOnly={unreadOnly} />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="alerts">{content}</WriteWorkflowV2> : content;
}
