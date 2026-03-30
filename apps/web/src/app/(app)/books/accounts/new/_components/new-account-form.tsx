"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@cashpile/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { createUda } from "@/modules/books/actions/account.actions";
import { createAccount } from "@/modules/books/actions/account.actions";
import type { BooksEntity } from "@/modules/books/types";

interface Props { entities: BooksEntity[] }

export default function NewAccountForm({ entities }: Props) {
  const router = useRouter();
  const [entityId, setEntityId] = useState(entities[0]?.id ?? "");
  const [udaName, setUdaName] = useState("");
  const [udaDescription, setUdaDescription] = useState("");
  const [accountName, setAccountName] = useState("");
  const [institution, setInstitution] = useState("");
  const [accountType, setAccountType] = useState<"checking" | "savings" | "credit_card" | "loan" | "investment" | "other">("checking");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!entityId || !udaName || !accountName) { setError("Entity, account group, and account name are required"); return; }
    setLoading(true);
    setError("");
    try {
      const uda = await createUda({ entityId, name: udaName, description: udaDescription || undefined });
      await createAccount({ uda_id: uda.id, name: accountName, institution: institution || undefined, account_type: accountType, currency: "USD" });
      router.push("/books/accounts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Account</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a new account group (e.g., rental property) with its first financial account.</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium">Entity</label>
          <Select value={entityId} onValueChange={setEntityId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <fieldset className="space-y-3 border rounded-lg p-4">
          <legend className="text-sm font-medium px-1">Account Group</legend>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Name (e.g., "123 Main St")</label>
            <Input value={udaName} onChange={(e) => setUdaName(e.target.value)} placeholder="Account group name" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Description (optional)</label>
            <Input value={udaDescription} onChange={(e) => setUdaDescription(e.target.value)} placeholder="Short description" />
          </div>
        </fieldset>

        <fieldset className="space-y-3 border rounded-lg p-4">
          <legend className="text-sm font-medium px-1">First Financial Account</legend>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Account name</label>
            <Input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="e.g., Chase Checking" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Institution (optional)</label>
            <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g., Chase Bank" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Account type</label>
            <Select value={accountType} onValueChange={(v) => setAccountType(v as typeof accountType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["checking", "savings", "credit_card", "loan", "investment", "other"].map((t) => (
                  <SelectItem key={t} value={t}>{t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </fieldset>

        <div className="flex gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Account"}</Button>
        </div>
      </form>
    </div>
  );
}
