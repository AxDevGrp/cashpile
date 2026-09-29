import { cache } from "react";
import { createServerSupabaseClient } from "@cashpile/db";
import { isConsumerEligible } from "./consumer-experience-policy";

/**
 * Request-local cached consumer experience resolver (contracts.md §1).
 *
 * Uses the session client; no process-global user cache. Missing row or any
 * query error resolves to disabled and logs only a sanitized code.
 */
export const getConsumerExperience = cache(
  async (): Promise<{ userId: string | null; enabled: boolean }> => {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { userId: null, enabled: false };

    const { data, error } = await supabase
      .from("app_feature_flags")
      .select("enabled, cohorts")
      .eq("key", "decision_first_experience")
      .maybeSingle();

    if (error) {
      console.warn("[consumer-experience] flag lookup failed");
      return { userId: user.id, enabled: false };
    }

    return {
      userId: user.id,
      enabled: isConsumerEligible(
        data ? { enabled: data.enabled === true, cohorts: data.cohorts } : null,
        user.id
      ),
    };
  }
);
