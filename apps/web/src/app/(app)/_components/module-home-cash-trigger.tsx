"use client";

import { ContextualCashTrigger } from "@/components/ui-v2";
import { useCashOverlay } from "./cash-overlay";

export function ModuleHomeCashTrigger({ prompt }: { prompt: string }) {
  const { open } = useCashOverlay();
  return <ContextualCashTrigger prompt={prompt} onTrigger={(value) => open(value, false)} />;
}
