import { getWriteWorkflow, type WriteWorkflowId } from "@/components/ui-v2/write-workflow-model";
import { ModuleHomeCashTrigger } from "./module-home-cash-trigger";
import styles from "./write-workflow-v2.module.css";

export function WriteWorkflowV2({
  id,
  children,
}: {
  id: WriteWorkflowId;
  children: React.ReactNode;
}) {
  const workflow = getWriteWorkflow(id);

  return (
    <div className={styles.workflow} data-write-workflow={id}>
      <div className={styles.guide}>
        <span>Review changes before saving.</span>
        <ModuleHomeCashTrigger prompt={workflow.cashPrompt} />
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
