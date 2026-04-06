"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@cashpile/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { createAccount, assignAccountToTaxEntity } from "@/modules/books/actions/account.actions";
import type { TaxEntity } from "@/modules/books/types";

interface Props { taxEntities: TaxEntity[] }

export default function NewAccountForm({ taxEntities }: Props) {
  const router = useRouter();
  const [taxEntityId, setTaxEntityId] = useState(taxEntities[0]?.id ?? "");
  const [accountName, setAccountName] = useState("");
  const [institution, setInstitution] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings" | "credit_card" | "loan" | "investment" | "other">("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountName) { setError("Account name is required"); return; }
    setLoading(true);
    setError("");
    try {
      const account = await createAccount({ 
        name: accountName, 
        institution_name: institution || undefined, 
        account_type: accountType, 
        currency: "USD",
        tax_entity_id: taxEntityId || undefined,
      });
      // If a tax entity was selected, assign the account to it
      if (taxEntityId && account.id) {
        await assignAccountToTaxEntity(account.id, taxEntityId);
      }
      router.push("/books/accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Financial Account</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a new bank account, credit card, or other financial account.</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Tax Entity (optional)</label>
          <Select value={taxEntityId} onValueChange={setTaxEntityId}>
            <SelectTrigger><SelectValue placeholder="Select a Tax Entity or leave empty for personal account" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">-- Personal Account (no entity) --</SelectItem>
              {taxEntities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Assign this account to a Tax Entity for business purposes, or leave empty for personal use.</p>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Account name</label>
          <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g., Chase Checking" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Institution (optional)</label>
          <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g., Chase Bank" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Account type</label>
          <Select value={accountType} onValueChange={(v) => setAccountType(v as typeof accountType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["checking", "savings", "credit_card", "loan", "investment", "other"].map((t) => (
                <SelectItem key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Account"}</Button>
        </div>
      </form>
    </div>
  );
}
