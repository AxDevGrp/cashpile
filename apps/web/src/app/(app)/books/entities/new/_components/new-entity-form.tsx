"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@cashpile/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { createTaxEntity } from "@/modules/books/actions/entity.actions";
import type { TaxEntity } from "@/modules/books/types";

const ENTITY_TYPES: { value: TaxEntity["entity_type"]; label: string }[] = [
  { value: "llc", label: "LLC" },
  { value: "s_corp", label: "S-Corp" },
  { value: "c_corp", label: "C-Corp" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "rental_property", label: "Rental Property" },
];

export default function NewEntityForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<TaxEntity["entity_type"]>("llc");
  const [taxId, setTaxId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name) { setError("Name is required"); return; }
    setLoading(true);
    setError("");
    try {
      await createTaxEntity({
        name,
        entity_type: entityType,
        tax_id: taxId || null,
        is_active: true,
      });
      router.push("/books/entities");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Tax Entity");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">New Tax Entity</h1>
        <p className="text-muted-foreground text-sm mt-1">Create a business entity for tax reporting purposes.</p>
      </div>

      {error && <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium">Entity name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Flyrocks Properties LLC" />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Entity Type</label>
          <Select value={entityType} onValueChange={(v) => setEntityType(v as TaxEntity["entity_type"])}>
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

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Tax Entity"}</Button>
        </div>
      </form>
    </div>
  );
}
