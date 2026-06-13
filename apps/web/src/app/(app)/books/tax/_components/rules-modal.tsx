"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  getTaxAssignmentRules,
  createTaxAssignmentRule,
  updateTaxAssignmentRule,
  deleteTaxAssignmentRule,
  testRulePattern,
  applyRulesToExistingTransactions,
  type TaxAssignmentRule,
} from "@/modules/books/actions/tax.actions";
import type { BooksAccount, TaxEntity } from "@/modules/books/types";

interface Props {
  taxEntities: TaxEntity[];
  accounts: BooksAccount[];
  onClose: () => void;
}

export function RulesModal({ taxEntities, accounts, onClose }: Props) {
  const [rules, setRules] = useState<TaxAssignmentRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [editingRule, setEditingRule] = useState<TaxAssignmentRule | null>(null);
  const [applying, setApplying] = useState(false);

  // Form state
  const [pattern, setPattern] = useState("");
  const [matchType, setMatchType] = useState<"contains" | "equals">("contains");
  const [entityId, setEntityId] = useState("");
  const [businessPct, setBusinessPct] = useState(100);
  const [deductionPct, setDeductionPct] = useState(100);
  const [priority, setPriority] = useState(0);
  const [accountId, setAccountId] = useState("global");

  // Test state
  const [testResults, setTestResults] = useState<Array<{ id: string; description: string; merchant: string | null; amount: number; date: string }>>([]);
  const [isTesting, setIsTesting] = useState(false);

  const loadRules = useCallback(async () => {
    try {
      const data = await getTaxAssignmentRules();
      setRules(data);
    } catch (err) {
      toast.error("Failed to load rules");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleTest = async () => {
    if (!pattern) return;
    setIsTesting(true);
    try {
      const results = await testRulePattern(pattern, matchType, 5, accountId === "global" ? null : accountId);
      setTestResults(results);
    } catch (err) {
      toast.error("Failed to test pattern");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!pattern || !entityId) {
      toast.error("Pattern and Tax Entity are required");
      return;
    }

    try {
      if (editingRule) {
        await updateTaxAssignmentRule(editingRule.id, {
          pattern,
          match_type: matchType,
          tax_entity_id: entityId,
          business_percentage: businessPct,
          deduction_percentage: deductionPct,
          priority,
          financial_account_id: accountId === "global" ? null : accountId,
        });
        toast.success("Rule updated");
      } else {
        await createTaxAssignmentRule({
          pattern,
          match_type: matchType,
          tax_entity_id: entityId,
          business_percentage: businessPct,
          deduction_percentage: deductionPct,
          priority,
          financial_account_id: accountId === "global" ? null : accountId,
        });
        toast.success("Rule created");
      }
      resetForm();
      loadRules();
    } catch (err) {
      toast.error(editingRule ? "Failed to update rule" : "Failed to create rule");
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await deleteTaxAssignmentRule(ruleId);
      toast.success("Rule deleted");
      loadRules();
    } catch (err) {
      toast.error("Failed to delete rule");
    }
  };

  const handleToggleActive = async (rule: TaxAssignmentRule) => {
    try {
      await updateTaxAssignmentRule(rule.id, { is_active: !rule.is_active });
      toast.success(rule.is_active ? "Rule disabled" : "Rule enabled");
      loadRules();
    } catch (err) {
      toast.error("Failed to update rule");
    }
  };

  const handleApplyToExisting = async () => {
    setApplying(true);
    try {
      const result = await applyRulesToExistingTransactions();
      toast.success(`Applied rules to ${result.assigned} transactions`);
    } catch (err) {
      toast.error("Failed to apply rules");
    } finally {
      setApplying(false);
    }
  };

  const startEdit = (rule: TaxAssignmentRule) => {
    setEditingRule(rule);
    setPattern(rule.pattern);
    setMatchType(rule.match_type);
    setEntityId(rule.tax_entity_id);
    setBusinessPct(rule.business_percentage);
    setDeductionPct(rule.deduction_percentage);
    setPriority(rule.priority);
    setAccountId(rule.financial_account_id ?? "global");
    setIsCreating(true);
  };

  const resetForm = () => {
    setEditingRule(null);
    setPattern("");
    setMatchType("contains");
    setEntityId("");
    setBusinessPct(100);
    setDeductionPct(100);
    setPriority(0);
    setAccountId("global");
    setTestResults([]);
    setIsCreating(false);
  };

  const getEntityName = (id: string) => {
    return taxEntities.find((e) => e.id === id)?.name ?? "Unknown";
  };

  const accountLabel = (account: BooksAccount) => `${account.name}${account.last_four_digits ? ` - *${account.last_four_digits}` : ""}`;

  const getScopeName = (id?: string | null) => {
    if (!id) return "All accounts";
    const account = accounts.find((item) => item.id === id);
    return account ? accountLabel(account) : "Account-scoped";
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold">Auto-Assignment Rules</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Info */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            Rules automatically assign transactions to Tax Entities based on description/merchant patterns.
            Higher priority rules are checked first.
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsCreating(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
            >
              + New Rule
            </button>
            <button
              onClick={handleApplyToExisting}
              disabled={applying || rules.length === 0}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm hover:bg-secondary/80 disabled:opacity-50"
            >
              {applying ? "Applying..." : "Apply to Existing Transactions"}
            </button>
          </div>

          {/* Create/Edit Form */}
          {isCreating && (
            <div className="border border-border rounded-lg p-4 space-y-4">
              <h3 className="font-medium">{editingRule ? "Edit Rule" : "New Rule"}</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Pattern</label>
                  <input
                    type="text"
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g., starbucks or Chevron"
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Match Type</label>
                  <select
                    value={matchType}
                    onChange={(e) => setMatchType(e.target.value as "contains" | "equals")}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="contains">Contains (fuzzy)</option>
                    <option value="equals">Equals (exact)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Tax Entity</label>
                  <select
                    value={entityId}
                    onChange={(e) => setEntityId(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="">Select entity...</option>
                    {taxEntities.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Priority</label>
                  <input
                    type="number"
                    value={priority}
                    onChange={(e) => setPriority(Number(e.target.value))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Scope</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  >
                    <option value="global">All accounts</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>{accountLabel(account)}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Business %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={businessPct}
                    onChange={(e) => setBusinessPct(Number(e.target.value))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Deduction %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={deductionPct}
                    onChange={(e) => setDeductionPct(Number(e.target.value))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Test Pattern */}
              <div className="flex gap-2">
                <button
                  onClick={handleTest}
                  disabled={!pattern || isTesting}
                  className="bg-secondary text-secondary-foreground px-3 py-1.5 rounded-md text-sm hover:bg-secondary/80 disabled:opacity-50"
                >
                  {isTesting ? "Testing..." : "Test Pattern"}
                </button>
              </div>

              {testResults.length > 0 && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-sm font-medium mb-2">Sample Matches:</p>
                  <div className="space-y-1 max-h-32 overflow-auto">
                    {testResults.map((tx) => (
                      <div key={tx.id} className="text-xs text-muted-foreground">
                        {tx.description} — ${tx.amount.toFixed(2)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {testResults.length === 0 && !isTesting && pattern && (
                <p className="text-sm text-muted-foreground">No recent transactions match this pattern.</p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
                >
                  {editingRule ? "Update Rule" : "Create Rule"}
                </button>
                <button
                  onClick={resetForm}
                  className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm hover:bg-secondary/80"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Rules List */}
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading rules...</p>
          ) : rules.length === 0 ? (
            <p className="text-muted-foreground text-sm">No rules yet. Create one to auto-assign transactions.</p>
          ) : (
            <div className="space-y-2">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`border border-border rounded-lg p-3 flex items-center justify-between ${!rule.is_active ? "opacity-50" : ""}`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">"{rule.pattern}"</span>
                      <span className="text-xs text-muted-foreground">({rule.match_type})</span>
                      {rule.priority > 0 && (
                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Priority: {rule.priority}</span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      → {getEntityName(rule.tax_entity_id)} @ {rule.business_percentage}% business, {rule.deduction_percentage}% deductible
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Scope: {getScopeName(rule.financial_account_id)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(rule)}
                      className={`text-xs px-2 py-1 rounded ${rule.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                    >
                      {rule.is_active ? "Active" : "Inactive"}
                    </button>
                    <button
                      onClick={() => startEdit(rule)}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-xs text-destructive hover:text-destructive/80"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
