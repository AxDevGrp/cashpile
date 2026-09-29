"use client";

import { createContext, useContext } from "react";

/**
 * Stage 07: lets nested route layouts (Books) bypass module chrome on the
 * named consumer routes without a second database lookup. Default false keeps
 * nonconsumer rendering unchanged.
 */
export const ConsumerExperienceContext = createContext(false);

export function useConsumerEnabled(): boolean {
  return useContext(ConsumerExperienceContext);
}
