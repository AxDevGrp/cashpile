import { listEvents } from "@/modules/pulse/actions/event.actions";
import EventsClient from "./_components/events-client";

export const metadata = { title: "Events — Pulse | Cashpile" };

interface PageProps {
  searchParams: Promise<{
    category?: string;
    severity?: string;
    from?: string;
    to?: string;
    instrument?: string;
  }>;
}

export default async function PulseEventsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const events = await listEvents({
    category: params.category as never,
    severity: params.severity as never,
    from: params.from,
    to: params.to,
    instrument: params.instrument,
    limit: 50,
  });

  return <EventsClient events={events} filters={params} />;
}
