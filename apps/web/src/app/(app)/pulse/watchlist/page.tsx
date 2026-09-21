import { listWatchlist } from "@/modules/pulse/actions/watchlist.actions";
import { listEvents } from "@/modules/pulse/actions/event.actions";
import WatchlistClient from "./_components/watchlist-client";
import { isUiV2Enabled } from "@/components/ui-v2";
import { WriteWorkflowV2 } from "../../_components/write-workflow-v2";

export const metadata = { title: "Watchlist — Pulse | Cashpile" };

export default async function PulseWatchlistPage() {
  const [watchlist, recentEvents] = await Promise.all([
    listWatchlist(),
    listEvents({ limit: 20 }),
  ]);

  const content = <WatchlistClient watchlist={watchlist} recentEvents={recentEvents} />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="watchlist">{content}</WriteWorkflowV2> : content;
}
