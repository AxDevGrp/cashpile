"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@cashpile/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { createEntity } from "@/modules/books/actions/entity.actions";
import type { BooksEntity } from "@/modules/books/types";

const ENTITY_TYPES: { value: BooksEntity["type"]; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "llc", label: "LLC" },
  { value: "s_corp", label: "S Corp" },
  { value: "c_corp", label: "C Corp" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_prop", label: "Sole Proprietor" },
];

export default function NewEntityForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<BooksEntity["type"]>("llc");
  const [taxId, setTaxId] = useState("");
  const [fiscalYearStart, setFiscalYearStart] = useState("1");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) { setError("Name is required"); return; }
    setLoading(true);
    setError("");
    try {
      await createEntity({
        name,
        type,
        tax_id: taxId || null,
        fiscal_year_start: parseInt(fiscalYearStart),
        default_currency: "USD",
      });
      router.push("/books/entities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create entity");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Entity</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a business entity or personal profile for your books.</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Entity name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Acme Rentals LLC" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Type</label>
          <Select value={type} onValueChange={(v) => setType(v as BooksEntity["type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {ENTITY_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">EIN / Tax ID (optional)</label>
          <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="XX-XXXXXXX" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Fiscal year start month</label>
          <Select value={fiscalYearStart} onValueChange={setFiscalYearStart}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Entity"}</Button>
        </div>
      </form>
    </div>
  );
}
