"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { createTaxEntity } from "@/modules/books/actions/entity.actions";
import type { TaxEntity } from "@/modules/books/types";

interface Props {
  onClose: () => void;
}

const ENTITY_TYPES: { value: TaxEntity["entity_type"]; label: string }[] = [
  { value: "llc", label: "LLC" },
  { value: "s_corp", label: "S-Corp" },
  { value: "c_corp", label: "C-Corp" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "rental_property", label: "Rental Property" },
];

export function AddTaxEntityModal({ onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState<TaxEntity["entity_type"]>("llc");
  const [taxId, setTaxId] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Entity name is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createTaxEntity({
        name: name.trim(),
        entity_type: entityType,
        tax_id: taxId.trim() || null,
        description: description.trim() || null,
        is_active: true,
      });
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create Tax Entity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="font-semibold">Add Tax Entity</div>
            <div className="text-xs text-muted-foreground">Create an LLC, business, rental, or other tax reporting entity.</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && <div className="rounded-md bg-destructive/10 border border-destructive/40 p-3 text-sm text-destructive">{error}</div>}

          <div className="space-y-1">
            <label className="text-sm font-medium">Entity name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Axial Development Group" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Entity type</label>
            <Select value={entityType} onValueChange={(value) => setEntityType(value as TaxEntity["entity_type"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((type) => <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">EIN / Tax ID <span className="text-muted-foreground font-normal">optional</span></label>
            <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="XX-XXXXXXX" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">optional</span></label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this entity is used for" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create Tax Entity"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
