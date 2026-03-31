import { getUserCreditBalance } from "@cashpile/db";
import { createServerSupabaseClient } from "@cashpile/db";
import { cn } from "@cashpile/ui";
import { Zap } from "lucide-react";
import { PLAN_MONTHLY_CREDITS } from "@cashpile/db";
import type { Plan } from "@cashpile/db";

interface Props {
  className?: string;
}

export async function CreditBalance({ className }: Props) {
  // Auth
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Balance + plan
  const [balance, subData] = await Promise.all([
    getUserCreditBalance(user.id),
    supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => data),
  ]);

  const plan = (subData?.plan ?? "free") as Plan;
  const maxCredits = PLAN_MONTHLY_CREDITS[plan];
  const subscriptionPct = maxCredits > 0
    ? Math.min(100, Math.round((balance.subscriptionCredits / maxCredits) * 100))
    : 0;

  const isWarning = balance.total > 0 && balance.total < maxCredits * 0.2;
  const isEmpty = balance.total <= 0;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/* Label row */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Zap className="h-3 w-3" />
          AI Credits
        </span>
        <span
          className={cn(
            "font-medium tabular-nums",
            isEmpty && "text-destructive",
            isWarning && !isEmpty && "text-amber-400",
            !isEmpty && !isWarning && "text-foreground"
          )}
        >
          {balance.total.toLocaleString()}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            isEmpty && "w-0",
            isWarning && !isEmpty && "bg-amber-400",
            !isEmpty && !isWarning && "bg-primary"
          )}
          style={{ width: `${subscriptionPct}%` }}
        />
      </div>

      {/* State hint */}
      {isEmpty && (
        <p className="text-[10px] text-destructive">No credits — top up to use AI</p>
      )}
      {isWarning && !isEmpty && (
        <p className="text-[10px] text-amber-400">Credits running low</p>
      )}
      {balance.topupCredits > 0 && (
        <p className="text-[10px] text-muted-foreground">
          +{balance.topupCredits.toLocaleString()} topup credits
        </p>
      )}
    </div>
  );
}
