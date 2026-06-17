"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader, Progress, formatCurrency, formatDate } from "@cashpile/ui";
import {
  bulkMergeDuplicateGroups,
  bulkMarkDuplicateGroupsReviewed,
  deleteDuplicateTransactions,
  markDuplicateGroupReviewed,
  mergeDuplicateTransactions,
  type DuplicateReviewGroup,
} from "@/modules/books/actions/duplicate.actions";

type Props = {
  groups: DuplicateReviewGroup[];
};

const BULK_MERGE_GROUP_CHUNK_SIZE = 25;

export default function DuplicateReviewClient({ groups }: Props) {
  const router = useRouter();
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [keepers, setKeepers] = useState<Record<string, string>>(() =>
    Object.fromEntries(groups.map((group) => [group.id, group.transactions[0]?.id ?? ""]))
  );
  const [selectedDeletes, setSelectedDeletes] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(groups.map((group) => [group.id, new Set(group.transactions.slice(1).map((tx) => tx.id))]))
  );
  const [bulkProgress, setBulkProgress] = useState<{
    active: boolean;
    completedGroups: number;
    totalGroups: number;
    mergedTransactions: number;
    totalTransactions: number;
    currentLabel?: string;
  } | null>(null);

  const duplicateTransactionCount = useMemo(
    () => groups.reduce((sum, group) => sum + Math.max(group.transactions.length - 1, 0), 0),
    [groups]
  );

  function validKeeperForGroup(group: DuplicateReviewGroup, currentKeeper?: string) {
    return group.transactions.some((tx) => tx.id === currentKeeper)
      ? currentKeeper!
      : group.transactions[0]?.id ?? "";
  }

  function defaultDeleteIdsForGroup(group: DuplicateReviewGroup, keeperId: string) {
    return group.transactions.filter((tx) => tx.id !== keeperId).map((tx) => tx.id);
  }

  function selectedDeleteIdsForGroup(group: DuplicateReviewGroup, keeperId: string) {
    const validIds = new Set(group.transactions.map((tx) => tx.id));
    const selected = Array.from(selectedDeletes[group.id] ?? [])
      .filter((id) => id !== keeperId && validIds.has(id));
    return selected.length > 0 ? selected : defaultDeleteIdsForGroup(group, keeperId);
  }

  useEffect(() => {
    setKeepers((current) => {
      const next: Record<string, string> = {};
      for (const group of groups) {
        next[group.id] = validKeeperForGroup(group, current[group.id]);
      }
      return next;
    });

    setSelectedDeletes((current) => {
      const next: Record<string, Set<string>> = {};
      for (const group of groups) {
        const keeperId = validKeeperForGroup(group, keepers[group.id]);
        const validIds = new Set(group.transactions.map((tx) => tx.id));
        const selected = Array.from(current[group.id] ?? [])
          .filter((id) => id !== keeperId && validIds.has(id));
        next[group.id] = new Set(selected.length > 0 ? selected : defaultDeleteIdsForGroup(group, keeperId));
      }
      return next;
    });
  }, [groups]);

  function runAction(groupId: string, action: () => Promise<unknown>, success: string) {
    setPendingGroupId(groupId);
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Duplicate review action failed");
      } finally {
        setPendingGroupId(null);
      }
    });
  }

  function runBulkAction(action: () => Promise<unknown>, success: string) {
    setPendingGroupId("bulk");
    startTransition(async () => {
      try {
        await action();
        toast.success(success);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Bulk duplicate review action failed");
      } finally {
        setPendingGroupId(null);
      }
    });
  }

  function bulkMergeSelections() {
    const payload = groups
      .map((group) => {
        const keeperId = validKeeperForGroup(group, keepers[group.id]);
        const duplicateIds = selectedDeleteIdsForGroup(group, keeperId);
        return { group, keeperId, duplicateIds };
      })
      .filter((item) => item.keeperId && item.duplicateIds.length > 0);

    if (payload.length === 0) {
      toast.info("No selected duplicates to merge");
      return;
    }

    const duplicateCount = payload.reduce((sum, item) => sum + item.duplicateIds.length, 0);
    if (!window.confirm(`Merge ${payload.length} groups and delete ${duplicateCount} duplicate transaction(s)?`)) return;

    setPendingGroupId("bulk");
    setBulkProgress({
      active: true,
      completedGroups: 0,
      totalGroups: payload.length,
      mergedTransactions: 0,
      totalTransactions: duplicateCount,
      currentLabel: "Starting bulk merge…",
    });

    startTransition(async () => {
      let completedGroups = 0;
      let mergedTransactions = 0;
      try {
        for (let index = 0; index < payload.length; index += BULK_MERGE_GROUP_CHUNK_SIZE) {
          const chunk = payload.slice(index, index + BULK_MERGE_GROUP_CHUNK_SIZE);
          const first = chunk[0];
          setBulkProgress({
            active: true,
            completedGroups,
            totalGroups: payload.length,
            mergedTransactions,
            totalTransactions: duplicateCount,
            currentLabel: first
              ? `${formatDate(first.group.transactions[0].date)} · ${formatCurrency(first.group.transactions[0].amount)}`
              : "Processing bulk merge…",
          });

          const result = await bulkMergeDuplicateGroups(chunk.map((item) => ({
            keeperId: item.keeperId,
            duplicateIds: item.duplicateIds,
          })));
          completedGroups += chunk.length;
          mergedTransactions += result.merged;

          setBulkProgress({
            active: true,
            completedGroups,
            totalGroups: payload.length,
            mergedTransactions,
            totalTransactions: duplicateCount,
            currentLabel: `${completedGroups} of ${payload.length} groups complete`,
          });
        }

        toast.success(`Merged ${mergedTransactions} duplicate transaction(s) across ${completedGroups} groups`);
        setBulkProgress((current) => current ? { ...current, active: false, currentLabel: "Bulk merge complete" } : null);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Bulk merge failed");
        setBulkProgress((current) => current ? { ...current, active: false, currentLabel: "Bulk merge stopped" } : null);
      } finally {
        setPendingGroupId(null);
      }
    });
  }

  function bulkMarkReviewed() {
    const ids = groups.flatMap((group) => group.transactions.map((tx) => tx.id));
    if (ids.length === 0) return;
    if (!window.confirm(`Mark all ${groups.length} duplicate groups as reviewed without deleting anything?`)) return;
    runBulkAction(() => bulkMarkDuplicateGroupsReviewed(ids), `Marked ${groups.length} groups as reviewed`);
  }

  function setKeeper(groupId: string, keeperId: string) {
    setKeepers((current) => ({ ...current, [groupId]: keeperId }));
    setSelectedDeletes((current) => {
      const group = groups.find((item) => item.id === groupId);
      const next = new Set(current[groupId] ?? []);
      next.delete(keeperId);
      if (group) {
        for (const tx of group.transactions) {
          if (tx.id !== keeperId && !next.has(tx.id)) next.add(tx.id);
        }
      }
      return { ...current, [groupId]: next };
    });
  }

  function toggleDelete(groupId: string, txId: string) {
    const group = groups.find((item) => item.id === groupId);
    const keeperId = group ? validKeeperForGroup(group, keepers[groupId]) : keepers[groupId];
    if (keeperId === txId) return;
    setSelectedDeletes((current) => {
      const next = new Set(current[groupId] ?? []);
      next.has(txId) ? next.delete(txId) : next.add(txId);
      return { ...current, [groupId]: next };
    });
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Duplicate Review"
        description={`${groups.length} groups · ${duplicateTransactionCount} removable duplicate transactions`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button disabled={isPending || groups.length === 0} onClick={bulkMergeSelections}>Merge All Selected</Button>
            <Button disabled={isPending || groups.length === 0} variant="outline" onClick={bulkMarkReviewed}>Mark All Reviewed</Button>
            <Link href="/books/transactions/import"><Button variant="outline">Import CSV</Button></Link>
            <Link href="/books/transactions"><Button variant="outline">Back to Transactions</Button></Link>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How to use this screen</CardTitle>
          <CardDescription>
            Choose the transaction to keep, then merge/delete the duplicates. By default, Cashpile preselects the row with the most useful data to keep and selects the rest for deletion, so “Merge All Selected” applies those recommendations across every group.
          </CardDescription>
        </CardHeader>
      </Card>

      {bulkProgress && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Bulk merge progress</CardTitle>
                <CardDescription>{bulkProgress.currentLabel}</CardDescription>
              </div>
              <Badge variant={bulkProgress.active ? "secondary" : "outline"}>
                {bulkProgress.completedGroups} / {bulkProgress.totalGroups} groups
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Progress value={bulkProgress.totalGroups === 0 ? 0 : Math.round((bulkProgress.completedGroups / bulkProgress.totalGroups) * 100)} />
            <div className="flex flex-wrap justify-between gap-3 text-sm text-muted-foreground">
              <span>{bulkProgress.mergedTransactions} / {bulkProgress.totalTransactions} duplicate transactions merged</span>
              <span>{bulkProgress.totalGroups === 0 ? 0 : Math.round((bulkProgress.completedGroups / bulkProgress.totalGroups) * 100)}% complete</span>
            </div>
          </CardContent>
        </Card>
      )}

      {groups.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No duplicate groups need review.
          </CardContent>
        </Card>
      ) : (
        groups.map((group) => {
          const keeperId = validKeeperForGroup(group, keepers[group.id]);
          const deleteIds = selectedDeleteIdsForGroup(group, keeperId);
          const disabled = isPending && pendingGroupId === group.id;

          return (
            <Card key={group.id} className="overflow-hidden">
              <CardHeader className="gap-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{formatDate(group.transactions[0].date)} · {formatCurrency(group.transactions[0].amount)}</CardTitle>
                    <CardDescription className="mt-1 line-clamp-2">{group.transactions[0].description}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={group.reason === "exact" ? "destructive" : "outline"}>
                      {group.reason === "exact" ? "Exact duplicate" : `Possible duplicate${group.confidence ? ` ${Math.round(group.confidence * 100)}%` : ""}`}
                    </Badge>
                    <Badge variant="outline">{group.transactions.length} rows</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="p-3 text-left">Keep</th>
                        <th className="p-3 text-left">Delete</th>
                        <th className="p-3 text-left">Date</th>
                        <th className="p-3 text-left">Description</th>
                        <th className="p-3 text-left">Account</th>
                        <th className="p-3 text-left">Category</th>
                        <th className="p-3 text-right">Amount</th>
                        <th className="p-3 text-left">Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.transactions.map((tx) => {
                        const isKeeper = keeperId === tx.id;
                        return (
                          <tr key={tx.id} className={isKeeper ? "border-b bg-emerald-50/70" : "border-b last:border-0"}>
                            <td className="p-3">
                              <input type="radio" name={`keeper-${group.id}`} checked={isKeeper} onChange={() => setKeeper(group.id, tx.id)} />
                            </td>
                            <td className="p-3">
                              <input type="checkbox" checked={!isKeeper && deleteIds.includes(tx.id)} disabled={isKeeper} onChange={() => toggleDelete(group.id, tx.id)} />
                            </td>
                            <td className="p-3 tabular-nums text-muted-foreground">{formatDate(tx.date)}</td>
                            <td className="max-w-xl p-3 text-xs leading-relaxed">{tx.description}</td>
                            <td className="p-3 text-muted-foreground">{tx.books_financial_accounts?.name ?? "—"}</td>
                            <td className="p-3 text-muted-foreground">{tx.books_categories?.name ?? "Uncategorized"}</td>
                            <td className={`p-3 text-right tabular-nums font-medium ${tx.amount < 0 ? "text-red-600" : "text-green-600"}`}>{formatCurrency(tx.amount)}</td>
                            <td className="p-3 text-muted-foreground">{tx.import_source ?? "manual"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    variant="outline"
                    disabled={disabled}
                    onClick={() => runAction(group.id, () => markDuplicateGroupReviewed(group.transactions.map((tx) => tx.id)), "Marked as reviewed")}
                  >
                    Not a Duplicate
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={disabled || deleteIds.length === 0}
                    onClick={() => {
                      if (!window.confirm(`Delete ${deleteIds.length} selected duplicate transaction(s)?`)) return;
                      runAction(group.id, () => deleteDuplicateTransactions(deleteIds), `Deleted ${deleteIds.length} duplicate transaction(s)`);
                    }}
                  >
                    Delete Selected
                  </Button>
                  <Button
                    disabled={disabled || deleteIds.length === 0}
                    onClick={() => {
                      if (!window.confirm(`Keep 1 transaction and merge/delete ${deleteIds.length} duplicate transaction(s)?`)) return;
                      runAction(group.id, () => mergeDuplicateTransactions(keeperId, deleteIds), `Merged ${deleteIds.length} duplicate transaction(s)`);
                    }}
                  >
                    Merge & Delete Selected
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
