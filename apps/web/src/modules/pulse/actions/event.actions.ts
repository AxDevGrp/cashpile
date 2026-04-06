"use server";

import { createServerSupabaseClient } from "@cashpile/db";
import { revalidatePath } from "next/cache";
import { getEventWithPrediction, triggerPrediction } from "../services/prediction.service";
import type { EventCategory, EventSeverity, EventWithPrediction, PulseEvent } from "../types";

interface ListEventsFilters {
  category?: EventCategory;
  severity?: EventSeverity;
  from?: string;
  to?: string;
  instrument?: string;
  limit?: number;
}

export async function listEvents(
  filters: ListEventsFilters = {}
): Promise<PulseEvent[]> {
  const supabase = await createServerSupabaseClient();
  const { limit = 50, category, severity, from, to, instrument } = filters;

  let q = supabase
    .from("pulse_events")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (category) q = q.eq("category", category);
  if (severity) q = q.eq("severity", severity);
  if (from) q = q.gte("published_at", from);
  if (to) q = q.lte("published_at", to);
  if (instrument) q = q.contains("affected_instruments", JSON.stringify([instrument]));

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((e) => ({
    ...e,
    affected_instruments: (e.affected_instruments as string[]) ?? [],
  })) as PulseEvent[];
}

export async function fetchEventWithPrediction(
  eventId: string
): Promise<EventWithPrediction | null> {
  const supabase = await createServerSupabaseClient();
  return getEventWithPrediction(supabase, eventId);
}

export async function triggerPredictionForEvent(eventId: string): Promise<string> {
  const supabase = await createServerSupabaseClient();

  const predictionId = await triggerPrediction(supabase, eventId);
  revalidatePath("/pulse/events");
  revalidatePath(`/pulse/events/${eventId}`);
  return predictionId;
}
