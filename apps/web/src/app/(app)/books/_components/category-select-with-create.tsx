"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@cashpile/ui";

type CategoryOption = {
  id: string | number;
  name: string;
  category_type?: string | null;
  type?: string | null;
  parent_category_id?: string | number | null;
  parent_id?: string | number | null;
};

function categoryType(category: CategoryOption) {
  return category.category_type ?? category.type ?? "expense";
}

function categoryParentId(category: CategoryOption) {
  return category.parent_category_id ?? category.parent_id ?? null;
}

function categoryLabel(category: CategoryOption, categories: CategoryOption[]) {
  const parentId = categoryParentId(category);
  const parent = parentId ? categories.find((item) => String(item.id) === String(parentId)) : null;
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

export function CategorySelectWithCreate({
  value,
  onChange,
  categories,
  onCategoriesChange,
  blankLabel,
  className = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm",
  defaultCategoryType = "expense",
  onBeforeCreate,
}: {
  value: string;
  onChange: (value: string) => void;
  categories: CategoryOption[];
  onCategoriesChange: (categories: any[]) => void;
  blankLabel?: string;
  className?: string;
  defaultCategoryType?: "income" | "expense" | "transfer" | "asset" | "liability" | "equity";
  onBeforeCreate?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("none");
  const [categoryTypeValue, setCategoryTypeValue] = useState(defaultCategoryType);
  const [saving, setSaving] = useState(false);
  const sortedCategories = [...categories].sort((a, b) => categoryLabel(a, categories).localeCompare(categoryLabel(b, categories)));

  function openCreate() {
    onBeforeCreate?.();
    setName("");
    setParentId("none");
    setCategoryTypeValue(defaultCategoryType);
    setOpen(true);
  }

  async function createCategory() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error("Enter a category name");
      return;
    }

    const parent = parentId === "none" ? null : categories.find((category) => String(category.id) === parentId);
    setSaving(true);
    try {
      const res = await fetch("/api/books/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          parentCategoryId: parent?.id ?? null,
          categoryType: parent ? categoryType(parent) : categoryTypeValue,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to create category");

      const nextCategories = data.categories ?? [...categories, data.category];
      onCategoriesChange(nextCategories);
      onChange(String(data.category.id));
      setOpen(false);
      toast.success(parent ? `Added ${parent.name} / ${data.category.name}` : `Added ${data.category.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create category");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <select
        className={className}
        value={value}
        onChange={(event) => {
          if (event.target.value === "__add_category__") {
            openCreate();
            return;
          }
          onChange(event.target.value);
        }}
      >
        {blankLabel !== undefined && <option value="">{blankLabel}</option>}
        {sortedCategories.map((category) => (
          <option key={category.id} value={String(category.id)}>{categoryLabel(category, categories)}</option>
        ))}
        <option value="__add_category__">+ Add category…</option>
      </select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add category</DialogTitle>
            <DialogDescription>Create a category or subcategory without leaving this page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <label className="space-y-1 text-sm block">
              <span className="font-medium">Name</span>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. AI Tools"
                autoFocus
              />
            </label>
            <label className="space-y-1 text-sm block">
              <span className="font-medium">Parent category</span>
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={parentId}
                onChange={(event) => setParentId(event.target.value)}
              >
                <option value="none">None — top-level category</option>
                {sortedCategories.map((category) => (
                  <option key={category.id} value={String(category.id)}>{categoryLabel(category, categories)}</option>
                ))}
              </select>
            </label>
            {parentId === "none" && (
              <label className="space-y-1 text-sm block">
                <span className="font-medium">Type</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={categoryTypeValue}
                  onChange={(event) => setCategoryTypeValue(event.target.value as typeof categoryTypeValue)}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="transfer">Transfer</option>
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                </select>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={createCategory} disabled={saving}>{saving ? "Adding…" : "Add category"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
