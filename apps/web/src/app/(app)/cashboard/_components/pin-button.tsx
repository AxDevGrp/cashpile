"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pin, PinOff } from "lucide-react";
import { setPriorityPinned } from "../actions";

interface Props {
  pinned: boolean;
}

export default function PinButton({ pinned }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      try {
        await setPriorityPinned(!pinned);
        toast.success(pinned ? "Priority unpinned" : "Priority pinned");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not update priority");
      }
    });
  }

  return (
    <button
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium hover:bg-muted"
      title={pinned ? "Stop pinning emergency cushion as your priority" : "Pin emergency cushion as your priority"}
    >
      {pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      {pinned ? "Unpin" : "Pin"}
    </button>
  );
}