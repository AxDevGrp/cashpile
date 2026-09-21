import {
  Activity,
  BookOpen,
  CreditCard,
  FileText,
  Gauge,
  LayoutGrid,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import {
  ModuleDock,
  ModuleEntrance,
  PriorityInsight,
  VisualAction,
} from "@/components/ui-v2";
import {
  getHomeActions,
  getHomePriorityInsight,
  type HomeReminder,
} from "@/components/ui-v2/home-model";
import { HomeV2Client } from "./home-v2-client";
import styles from "./home-v2.module.css";

export function HomeV2({
  canUseTax,
  reminder,
}: {
  canUseTax: boolean;
  reminder?: HomeReminder;
}) {
  const actions = getHomeActions(canUseTax);
  const insight = getHomePriorityInsight(reminder);

  return (
    <div className={styles.home}>
      <h1 className={styles.srOnly}>Cashpile Home</h1>
      <HomeV2Client />
      <section className={styles.actions} aria-label="Quick actions">
        <VisualAction {...actions[0]} icon={WalletCards} />
        <VisualAction {...actions[1]} icon={CreditCard} />
        <VisualAction
          {...actions[2]}
          icon={canUseTax ? FileText : BookOpen}
        />
        <VisualAction {...actions[3]} icon={LayoutGrid} />
      </section>
      <PriorityInsight insight={insight} actionHref={insight.actionHref} />
      <section id="modules" className={styles.modules} aria-labelledby="modules-title">
        <div>
          <h2 id="modules-title">Your modules</h2>
          <Link href="/cashboard?view=details">View dashboard details</Link>
        </div>
        <ModuleDock>
          <ModuleEntrance href="/cashflow" label="Flow" icon={Gauge} />
          <ModuleEntrance href="/books" label="Books" icon={BookOpen} />
          {canUseTax && <ModuleEntrance href="/books/tax" label="Tax" icon={FileText} />}
          <ModuleEntrance href="/trades" label="Trades" icon={TrendingUp} />
          <ModuleEntrance href="/pulse" label="Pulse" icon={Activity} />
        </ModuleDock>
      </section>
    </div>
  );
}
