import { listWatchlist } from "@/modules/pulse/actions/watchlist.actions";
import { getCorrelationGrid } from "@/modules/pulse/services/prediction.service";
import { createServerSupabaseClient } from "@cashpile/db";
import CorrelationsClient from "./_components/correlations-client";

export const metadata = { title: "Correlations — Pulse | Cashpile" };

const DEFAULT_INSTRUMENTS = ["ES", "NQ", "CL", "GC", "DXY", "TLT", "VIX"];

interface PageProps {
  searchParams: Promise<{ instruments?: string; days?: string }>;
}

export default async function PulseCorrelationsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const watchlist = await listWatchlist();
  const watchlistInstruments = watchlist.map((w) => w.instrument);

  const selectedInstruments = params.instruments
    ? params.instruments.split(",").filter(Boolean)
    : [...new Set([...watchlistInstruments, ...DEFAULT_INSTRUMENTS])].slice(0, 10);

  const days = Math.min(Math.max(Number(params.days ?? 30), 7), 90);

  const supabase = await createServerSupabaseClient();
  const grid = await getCorrelationGrid(supabase, selectedInstruments, days);

  return (
    <CorrelationsClient
      grid={grid}
      selectedInstruments={selectedInstruments}
      defaultInstruments={DEFAULT_INSTRUMENTS}
      watchlistInstruments={watchlistInstruments}
      days={days}
    />
  );
}
