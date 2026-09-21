"use client";

import { CashPrompt } from "@/components/ui-v2";
import { useCashOverlay } from "../../_components/cash-overlay";

export function HomeV2Client() {
  const { open } = useCashOverlay();

  return <CashPrompt onSubmit={(prompt) => open(prompt, true)} />;
}
