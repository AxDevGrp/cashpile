import DuplicateReviewClient from "./_components/duplicate-review-client";
import { listDuplicateReviewGroups } from "@/modules/books/actions/duplicate.actions";
import { WriteWorkflowV2 } from "../../../_components/write-workflow-v2";
import { isUiV2Enabled } from "@/components/ui-v2";

export const metadata = { title: "Duplicate Review — Books | Cashpile" };

export default async function DuplicateReviewPage() {
  const groups = await listDuplicateReviewGroups();
  const content = <DuplicateReviewClient groups={groups} />;
  return isUiV2Enabled() ? <WriteWorkflowV2 id="duplicates">{content}</WriteWorkflowV2> : content;
}
