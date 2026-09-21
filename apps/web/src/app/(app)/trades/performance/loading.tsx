import { PageSkeleton } from "@cashpile/ui";
import { isUiV2Enabled } from "@/components/ui-v2";
import { Phase7LoadingSurface } from "@/app/_components/phase-7-surface";

export default function PerformanceLoading() {
  return isUiV2Enabled() ? <Phase7LoadingSurface id="performance-loading" /> : <PageSkeleton cards={3} />;
}
