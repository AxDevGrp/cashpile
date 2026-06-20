"use client";

import { useEffect, useState } from "react";
import type { TaxEntity } from "@/modules/books/types";

interface Props {
  taxEntity: TaxEntity;
  year: number;
  onClose: () => void;
}

export function ExportPanel({ taxEntity, year, onClose }: Props) {
  const [format, setFormat] = useState<"csv" | "excel" | "mapped-workbook">("csv");
  const [exportYear, setExportYear] = useState(year);
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [review, setReview] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const years = Array.from({ length: 6 }, (_, i) => year - i);

  useEffect(() => {
    fetch("/api/tax/workbook-templates")
      .then((res) => res.json())
      .then((data) => {
        const list = data.templates ?? [];
        setTemplates(list);
        if (list[0]?.id) setTemplateId(list[0].id);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (format !== "mapped-workbook" || !templateId) return;
    fetch(`/api/tax/workbook-templates/${templateId}/mapping-review?taxEntityId=${taxEntity.id}&year=${exportYear}`)
      .then((res) => res.json())
      .then((data) => setReview(data))
      .catch((err) => setError(err.message));
  }, [format, templateId, taxEntity.id, exportYear]);

  const refreshReview = async () => {
    if (!templateId) return;
    const res = await fetch(`/api/tax/workbook-templates/${templateId}/mapping-review?taxEntityId=${taxEntity.id}&year=${exportYear}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Unable to refresh mapping review");
    setReview(data);
  };

  const handleTemplateUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("taxYear", String(exportYear));
      form.set("name", file.name.replace(/\.xlsx$/i, ""));
      const res = await fetch("/api/tax/workbook-templates", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      const nextTemplates = [data.template, ...templates];
      setTemplates(nextTemplates);
      setTemplateId(data.template.id);
      setFormat("mapped-workbook");
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const saveMapping = async (row: any, targetId: string) => {
    setError(null);
    const isIgnored = targetId === "__ignore__";
    const res = await fetch(`/api/tax/workbook-templates/${templateId}/mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxEntityId: taxEntity.id,
        taxYear: exportYear,
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        targetId: isIgnored ? null : targetId,
        isIgnored,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Unable to save mapping");
      return;
    }
    await refreshReview();
  };

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    const mappedWorkbook = format === "mapped-workbook";
    const res = await fetch(
      mappedWorkbook ? `/api/tax/workbook-templates/${templateId}/export` : "/api/tax/export",
      {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taxEntityId: taxEntity.id,
        taxEntityName: taxEntity.name,
        year: exportYear,
        format,
      }),
      }
    );
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = mappedWorkbook
        ? `completed-tax-workbook-${taxEntity.name}-${exportYear}.xlsx`
        : `tax-report-${taxEntity.name}-${exportYear}.${format === "csv" ? "csv" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Export failed");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="font-semibold">Export Tax Report</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-muted-foreground">{taxEntity.name}</div>

          <label className="block text-sm space-y-1">
            <span className="text-muted-foreground">Tax Year</span>
            <select
              value={exportYear}
              onChange={e => setExportYear(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
            >
              {years.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm space-y-1">
            <span className="text-muted-foreground">Format</span>
            <div className="flex gap-2">
              {(["csv", "excel", "mapped-workbook"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-1.5 rounded-md text-sm border ${
                    format === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  {f === "csv" ? "CSV" : f === "excel" ? "Excel" : "Fill uploaded workbook"}
                </button>
              ))}
            </div>
          </label>

          {format === "mapped-workbook" && (
            <div className="space-y-4 rounded-lg border border-border p-3">
              <div className="text-sm font-medium">Tax preparer workbook</div>
              <label className="block text-sm space-y-1">
                <span className="text-muted-foreground">Upload .xlsx template</span>
                <input
                  type="file"
                  accept=".xlsx"
                  disabled={uploading}
                  onChange={(event) => handleTemplateUpload(event.target.files?.[0] ?? null)}
                  className="w-full text-sm"
                />
              </label>

              {templates.length > 0 && (
                <label className="block text-sm space-y-1">
                  <span className="text-muted-foreground">Template</span>
                  <select
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} ({template.original_filename})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {review?.rows && (
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">
                    {review.mappedCount} mapped · {review.ignoredCount} ignored · {review.unmappedCount} unmapped blockers
                  </div>
                  <div className="max-h-72 overflow-auto border border-border rounded-md">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card">
                        <tr className="border-b border-border">
                          <th className="text-left p-2">Cashpile category</th>
                          <th className="text-right p-2">Amount</th>
                          <th className="text-left p-2">Workbook target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {review.rows.map((row: any) => (
                          <tr key={row.categoryId} className="border-b border-border/60">
                            <td className="p-2">
                              <div className="font-medium">{row.categoryName}</div>
                              <div className="text-muted-foreground">{row.status}</div>
                            </td>
                            <td className="p-2 text-right">
                              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(row.deductibleAmount)}
                            </td>
                            <td className="p-2">
                              <select
                                value={row.mapping?.isIgnored ? "__ignore__" : row.mapping?.targetId ?? ""}
                                onChange={(e) => saveMapping(row, e.target.value)}
                                className="w-full bg-background border border-border rounded-md px-2 py-1"
                              >
                                <option value="">Choose target…</option>
                                <option value="__ignore__">Ignore this category</option>
                                {(review.targets ?? []).map((target: any) => (
                                  <option key={target.id} value={target.id}>
                                    {target.sheet_name} → {target.label} ({target.target_cell})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-sm border border-border hover:bg-muted/30"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={loading || (format === "mapped-workbook" && (!templateId || review?.canExport === false))}
            className="px-4 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Exporting..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
