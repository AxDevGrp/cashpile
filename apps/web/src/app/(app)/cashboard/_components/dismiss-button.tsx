"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { dismissNextStep } from "../actions";

interface Props {
  ruleKey: string;
}

export default function DismissButton({ ruleKey }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function dismiss() {
    startTransition(async () => {
      try {
        await dismissNextStep(ruleKey);
        toast.success("Dismissed — we'll suggest the next best thing");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not dismiss");
      }
    });
  }

  return (
    <button
      onClick={dismiss}
      className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted"
    >
      Not now
    </button>
  );
}