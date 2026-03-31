"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  cn,
} from "@cashpile/ui";
import { Zap, Loader2, CreditCard } from "lucide-react";

interface TopupOption {
  amount: 5 | 10 | 25;
  credits: string;
  label: string;
  popular?: boolean;
}

const TOPUP_OPTIONS: TopupOption[] = [
  { amount: 5,  credits: "5M",  label: "$5" },
  { amount: 10, credits: "10M", label: "$10", popular: true },
  { amount: 25, credits: "25M", label: "$25" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TopupModal({ open, onOpenChange }: Props) {
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleTopup(amount: 5 | 10 | 25) {
    setLoading(amount);
    setError(null);
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Top up AI Credits
          </DialogTitle>
          <DialogDescription>
            Credits never expire. Subscription credits reset monthly; topup credits carry over.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 pt-2">
          {TOPUP_OPTIONS.map((opt) => (
            <button
              key={opt.amount}
              onClick={() => handleTopup(opt.amount)}
              disabled={loading !== null}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-all",
                "hover:border-primary/60 hover:bg-accent/40",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                opt.popular && "border-primary/40 bg-primary/5"
              )}
            >
              {opt.popular && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold text-primary-foreground">
                  Popular
                </span>
              )}
              <span className="text-lg font-bold">{opt.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {opt.credits} credits
              </span>
              {loading === opt.amount && (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-[12px] text-destructive text-center pt-1">{error}</p>
        )}

        <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
          <CreditCard className="h-3 w-3" />
          Secured by Stripe
        </div>
      </DialogContent>
    </Dialog>
  );
}
