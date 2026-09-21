import { PageSkeleton } from "@cashpile/ui";
import { isUiV2Enabled } from "@/components/ui-v2";
import { Phase7LoadingSurface } from "@/app/_components/phase-7-surface";

export default function EventsLoading() {
  return isUiV2Enabled() ? <Phase7LoadingSurface id="events-loading" /> : <PageSkeleton cards={0} />;
}
