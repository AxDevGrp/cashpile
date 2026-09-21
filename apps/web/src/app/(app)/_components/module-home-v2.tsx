import { BarChart3, Bell, BookOpen, FileText, Repeat2, WalletCards } from "lucide-react";
import Link from "next/link";
import { PriorityInsight, VisualAction, WorkspaceHeader, type UiV2Insight } from "@/components/ui-v2";
import { getModuleHomeDefinition, type ModuleActionIcon, type ModuleHomeId } from "@/components/ui-v2/module-home-model";
import { ModuleHomeCashTrigger } from "./module-home-cash-trigger";
import styles from "./module-home-v2.module.css";

const icons = { wallet: WalletCards, repeat: Repeat2, book: BookOpen, file: FileText, chart: BarChart3, bell: Bell } satisfies Record<ModuleActionIcon, typeof WalletCards>;

export function ModuleHomeV2({ id, insight, actionHref }: { id: ModuleHomeId; insight: UiV2Insight; actionHref?: string }) {
  const definition = getModuleHomeDefinition(id);
  return <div className={styles.home}>
    <WorkspaceHeader title={definition.title} detail={definition.detail} actions={<ModuleHomeCashTrigger prompt={definition.cashPrompt} />} />
    <section className={styles.actions} aria-label={`${definition.title} actions`}>
      {definition.actions.map((action) => <VisualAction key={action.href} {...action} icon={icons[action.icon]} />)}
    </section>
    <PriorityInsight insight={insight} actionHref={actionHref} />
    <Link className={styles.details} href={definition.detailsHref}>Open detailed workspace</Link>
  </div>;
}
