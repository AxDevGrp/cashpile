import { listWatchlist } from "@/modules/pulse/actions/watchlist.actions";
import { listEvents } from "@/modules/pulse/actions/event.actions";
import WatchlistClient from "./_components/watchlist-client";

export const metadata = { title: "Watchlist — Pulse | Cashpile" };

export default async function PulseWatchlistPage() {
  const [watchlist, recentEvents] = await Promise.all([
    listWatchlist(),
    listEvents({ limit: 20 }),
  ]);

  return <WatchlistClient watchlist={watchlist} recentEvents={recentEvents} />;
}
