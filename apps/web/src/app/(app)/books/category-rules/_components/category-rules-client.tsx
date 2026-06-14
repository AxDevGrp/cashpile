"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button, Card, CardContent, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import type { BooksAccount, BooksCategory } from "@/modules/books/types";
import type { BooksCategoryRule } from "@/modules/books/actions/category-rule.actions";
import { CategorySelectWithCreate } from "../../_components/category-select-with-create";

interface Props {
  initialRules: BooksCategoryRule[];
  categories: BooksCategory[];
  accounts: BooksAccount[];
}

export default function CategoryRulesClient({ initialRules, categories, accounts }: Props) {
  const [rules, setRules] = useState(initialRules);
  const [categoryOptions, setCategoryOptions] = useState(categories);
  const [pattern, setPattern] = useState("");
  const defaultCategory = categoryOptions.find((category) => category.name === "Software & Subscriptions") ?? categoryOptions[0];
  const [categoryId, setCategoryId] = useState(defaultCategory?.id ? String(defaultCategory.id) : "");
  const [accountId, setAccountId] = useState("global");
  const [saving, setSaving] = useState(false);

  function accountLabel(account: BooksAccount) {
    return `${account.name}${account.last_four_digits ? ` - *${account.last_four_digits}` : ""}`;
  }

  function ruleScopeLabel(rule: BooksCategoryRule) {
    if (!rule.financial_account_id) return "All accounts";
    const account = accounts.find((item) => item.id === rule.financial_account_id);
    return account ? accountLabel(account) : "Account-scoped";
  }

  async function refreshRules() {
    const res = await fetch("/api/books/category-rules", { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setRules(data.rules ?? []);
  }

  async function createRule() {
    if (!pattern.trim() || !categoryId) {
      toast.error("Pattern and category are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/books/category-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pattern, categoryId, matchType: "contains", accountId: accountId === "global" ? null : accountId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to create rule");
      setPattern("");
      toast.success(data.created > 1 ? `${data.created} category rules saved` : "Category rule saved");
      await refreshRules();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create rule");
    } finally {
      setSaving(false);
    }
  }

  async function toggleRule(rule: BooksCategoryRule) {
    const nextActive = !rule.is_active;
    setRules((current) => current.map((item) => item.id === rule.id ? { ...item, is_active: nextActive } : item));
    try {
      const res = await fetch("/api/books/category-rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rule.id, isActive: nextActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to update rule");
    } catch (error) {
      setRules((current) => current.map((item) => item.id === rule.id ? rule : item));
      toast.error(error instanceof Error ? error.message : "Unable to update rule");
    }
  }

  async function deleteRule(id: string) {
    const previous = rules;
    setRules((current) => current.filter((rule) => rule.id !== id));
    try {
      const res = await fetch(`/api/books/category-rules?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to delete rule");
      toast.success("Rule deleted");
    } catch (error) {
      setRules(previous);
      toast.error(error instanceof Error ? error.message : "Unable to delete rule");
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Category Rules"
        description="Reusable merchant rules Cashpile applies before AI. Manual transaction corrections create learned rules here automatically."
        actions={
          <Link href="/books/transactions?filter=uncategorized">
            <Button variant="outline"><ArrowLeft className="h-4 w-4" /> Back to queue</Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-[1fr_240px_240px_auto]">
            <Input
              value={pattern}
              onChange={(event) => setPattern(event.target.value)}
              placeholder="Merchant patterns, e.g. ANTHROPIC, OPENAI, OPENROUTER"
            />
            <CategorySelectWithCreate
              value={categoryId}
              onChange={setCategoryId}
              categories={categoryOptions}
              onCategoriesChange={setCategoryOptions}
              blankLabel="Choose category"
            />
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger aria-label="Rule scope">
                <SelectValue placeholder="Rule scope" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">All accounts</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>{accountLabel(account)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={createRule} disabled={saving}>{saving ? "Saving…" : "Add rule"}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-emerald-900">
        Cashpile includes a starter library of system rules for AI tools, developer SaaS, cloud hosting, streaming subscriptions, food delivery, travel, utilities, and common merchants. Add multiple merchants by separating them with commas.
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="p-3 text-left font-medium">Pattern</th>
                <th className="p-3 text-left font-medium">Category</th>
                <th className="p-3 text-left font-medium">Scope</th>
                <th className="p-3 text-left font-medium">Source</th>
                <th className="p-3 text-right font-medium">Matches</th>
                <th className="p-3 text-left font-medium">Status</th>
                <th className="p-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No category rules yet. Add one above or categorize transactions manually to teach Cashpile.
                  </td>
                </tr>
              ) : rules.map((rule) => (
                <tr key={rule.id} className="border-b last:border-0">
                  <td className="p-3 font-medium">{rule.pattern}</td>
                  <td className="p-3 text-muted-foreground">{rule.books_categories?.name ?? "Unknown"}</td>
                  <td className="p-3 text-muted-foreground">{ruleScopeLabel(rule)}</td>
                  <td className="p-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${rule.source === "system" ? "bg-blue-100 text-blue-700" : rule.source === "learned" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                      {rule.source}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">{rule.match_count}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => toggleRule(rule)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${rule.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                    >
                      {rule.is_active ? "Active" : "Paused"}
                    </button>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)} aria-label="Delete rule">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
