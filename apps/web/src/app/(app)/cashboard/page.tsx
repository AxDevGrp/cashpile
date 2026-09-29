import { getConsumerExperience } from "@/lib/consumer-experience";
import { getCashboardSnapshot } from "@cashpile/ai";
import { resolveMetricParam } from "@/components/ui-v2/consumer-model";
import LegacyDashboard from "./_components/legacy-dashboard";
import NewDashboard from "./_components/new-dashboard";
import { MetricDetail } from "./_components/metric-detail";

export default async function CashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ gremmy?: string; metric?: string }>;
}) {
  const { userId, enabled } = await getConsumerExperience();
  const resolved = await searchParams;
  if (!userId) return null;

  // The query can only choose a drill-in for an already-eligible consumer.
  const metric = enabled ? resolveMetricParam(resolved?.metric) : null;

  if (!enabled) return <LegacyDashboard searchParams={searchParams} />;

  if (metric) {
    const snapshot = await getCashboardSnapshot(userId).catch(() => null);
    if (!snapshot) return <NewDashboard />;
    return <MetricDetail metric={snapshot.metrics[metric]} />;
  }

  return <NewDashboard />;
}
