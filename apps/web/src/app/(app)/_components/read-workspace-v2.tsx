import { WorkspaceHeader } from "@/components/ui-v2";
import { getReadWorkspaceDefinition, type ReadWorkspaceId } from "@/components/ui-v2/read-workspace-model";
import { ModuleHomeCashTrigger } from "./module-home-cash-trigger";
import styles from "./read-workspace-v2.module.css";

export function ReadWorkspaceV2({
  id,
  children,
  actions,
}: {
  id: ReadWorkspaceId;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const definition = getReadWorkspaceDefinition(id);
  return (
    <div className={styles.workspace}>
      <WorkspaceHeader
        title={definition.title}
        detail={definition.detail}
        actions={
          <div className={styles.headerActions}>
            <ModuleHomeCashTrigger prompt={definition.cashPrompt} />
            {actions}
          </div>
        }
      />
      <div className={styles.content}>{children}</div>
    </div>
  );
}
