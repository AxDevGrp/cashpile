"use client";

import { useState } from "react";

type Uda = { id: string; name: string };

interface Props {
  uda: Uda;
  year: number;
  onClose: () => void;
}

export function ExportPanel({ uda, year, onClose }: Props) {
  const [format, setFormat] = useState<"csv" | "excel">("csv");
  const [exportYear, setExportYear] = useState(year);
  const [loading, setLoading] = useState(false);

  const years = Array.from({ length: 6 }, (_, i) => year - i);

  const handleExport = async () => {
    setLoading(true);
    const res = await fetch("/api/tax/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ udaId: uda.id, year: exportYear, format }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tax-report-${uda.name}-${exportYear}.${format === "csv" ? "csv" : "xlsx"}`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="font-semibold">Export Tax Report</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          <div className="text-sm text-muted-foreground">{uda.name}</div>

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
              {(["csv", "excel"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-1.5 rounded-md text-sm border ${
                    format === f
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  {f === "csv" ? "CSV" : "Excel"}
                </button>
              ))}
            </div>
          </label>
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
            disabled={loading}
            className="px-4 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? "Exporting..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
