import { notFound } from "next/navigation";
import {
  BookOpen,
  CircleDollarSign,
  CreditCard,
  FileCheck2,
  Gauge,
  Home,
  Landmark,
  MoreHorizontal,
  Settings,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  AppShellV2,
  CashPrompt,
  ContextualCashTrigger,
  EmptyState,
  ErrorState,
  LoadingState,
  ModuleDock,
  ModuleEntrance,
  PriorityInsight,
  UnauthorizedState,
  VisualAction,
  WorkspaceHeader,
  type UiV2NavigationItem,
} from "@/components/ui-v2";

const navigation: UiV2NavigationItem[] = [
  { href: "/ui-v2-preview", label: "Home", icon: Home },
  { href: "/books", label: "Books", icon: BookOpen },
  { href: "/cashflow", label: "Cash flow", icon: WalletCards },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function UiV2PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <AppShellV2 navigation={navigation} pathname="/ui-v2-preview">
      <WorkspaceHeader
        eyebrow="Cashpile"
        title="Morning, Jordan."
        detail="Cash is ready when you are."
        actions={<ContextualCashTrigger href="/ai" />}
      />
      <CashPrompt />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
        }}
      >
        <VisualAction
          href="/cashflow"
          icon={CircleDollarSign}
          label="Afford it?"
        />
        <VisualAction
          href="/cashflow/recurring"
          icon={CreditCard}
          label="Subscriptions"
        />
        <VisualAction href="/books/tax" icon={FileCheck2} label="Tax ready" />
        <VisualAction href="/books" icon={MoreHorizontal} label="More" />
      </div>
      <PriorityInsight
        actionHref="/cashflow/recurring"
        insight={{
          id: "subscription",
          severity: "attention",
          title: "Adobe went up $8.",
          actionLabel: "Review",
        }}
      />
      <ModuleDock>
        <ModuleEntrance
          href="/cashflow"
          icon={Gauge}
          label="Flow"
          description="Understand what is next."
        />
        <ModuleEntrance
          href="/books"
          icon={BookOpen}
          label="Books"
          description="Keep your records current."
        />
        <ModuleEntrance
          href="/books/tax"
          icon={Landmark}
          label="Tax"
          description="Stay ready."
        />
        <ModuleEntrance
          href="/trades"
          icon={TrendingUp}
          label="Trades"
          description="Review performance."
        />
      </ModuleDock>
      <details style={{ marginTop: 48 }}>
        <summary>Foundation state examples</summary>
        <section
          aria-label="State component examples"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          <LoadingState label="Preparing a sample workspace" />
          <EmptyState
            title="Nothing here yet"
            detail="Your next action will appear here."
          />
          <ErrorState detail="This is a static recovery-state example." />
          <UnauthorizedState detail="This is a static access-state example." />
        </section>
      </details>
    </AppShellV2>
  );
}
