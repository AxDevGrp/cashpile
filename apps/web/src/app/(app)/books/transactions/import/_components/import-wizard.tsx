"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { randomUUID } from "crypto";
import { Button, Progress, Badge, Dialog, DialogContent, DialogHeader, DialogTitle } from "@cashpile/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@cashpile/ui";
import { formatCurrency } from "@cashpile/ui";
import { getImportPreview, executeImport } from "@/modules/books/actions/import.actions";
import type { BooksEntity, BooksUda, ImportPreview } from "@/modules/books/types";

type Step = 1 | 2 | 3;

interface Props {
  entities: BooksEntity[];
  initialUdas: (BooksUda & { books_accounts?: { id: string; name: string }[] })[];
}

export default function ImportWizard({ entities, initialUdas }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [csvContent, setCsvContent] = useState("");
  const [entityId, setEntityId] = useState(entities[0]?.id ?? "");
  const [accountId, setAccountId] = useState("");
  const [udas, setUdas] = useState(initialUdas);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [overrideDuplicates, setOverrideDuplicates] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number; duplicatesSkipped: number } | null>(null);

  const allAccounts = udas.flatMap((u) => u.books_accounts ?? []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvContent(ev.target?.result as string ?? "");
    reader.readAsText(file);
  }, []);

  async function handlePreview() {
    if (!csvContent) { setError("Please select a CSV file"); return; }
    if (!accountId) { setError("Please select an account"); return; }
    setLoading(true);
    setError("");
    try {
      const p = await getImportPreview(csvContent);
      setPreview(p);
      if (p.errors.length > 0 && p.transactions.length === 0) {
        setError(p.errors.join("\n"));
      } else {
        setStep(2);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setLoading(true);
    setError("");
    try {
      const res = await executeImport(csvContent, accountId, entityId, overrideDuplicates);
      setResult({ imported: res.imported, skipped: res.skipped, duplicatesSkipped: res.duplicatesSkipped });
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  const progressValue = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import Transactions</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload a bank CSV to import transactions into Books.</p>
      </div>

      {/* Step indicator */}
      <div className="space-y-2">
        <Progress value={progressValue} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className={step >= 1 ? "text-foreground font-medium" : ""}>1. Upload</span>
          <span className={step >= 2 ? "text-foreground font-medium" : ""}>2. Preview</span>
          <span className={step >= 3 ? "text-foreground font-medium" : ""}>3. Done</span>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive whitespace-pre-wrap">
          {error}
        </div>
      )}

      {/* Step 1 — Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Entity</label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger><SelectValue placeholder="Select entity" /></SelectTrigger>
              <SelectContent>
                {entities.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Account</label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {allAccounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CSV File</label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFile}
              className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
            />
          </div>

          <Button onClick={handlePreview} disabled={loading || !csvContent}>
            {loading ? "Parsing…" : "Preview Import →"}
          </Button>
        </div>
      )}

      {/* Step 2 — Preview */}
      {step === 2 && preview && (
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <span className="font-medium">{preview.totalRows} rows</span>
            {preview.duplicateCount > 0 && (
              <Badge variant="outline" className="text-yellow-600 border-yellow-400">{preview.duplicateCount} duplicates</Badge>
            )}
            {preview.transferCount > 0 && (
              <Badge variant="outline">{preview.transferCount} transfers</Badge>
            )}
          </div>

          {preview.duplicateCount > 0 && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={overrideDuplicates}
                onChange={(e) => setOverrideDuplicates(e.target.checked)}
              />
              Import duplicates anyway
            </label>
          )}

          <div className="rounded-lg border max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 border-b">
                <tr>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Amount</th>
                  <th className="p-2 text-left">Flags</th>
                </tr>
              </thead>
              <tbody>
                {preview.transactions.map((tx, i) => (
                  <tr key={i} className={`border-b last:border-0 ${tx.isDuplicate ? "bg-yellow-50 dark:bg-yellow-950/20" : ""}`}>
                    <td className="p-2 tabular-nums">{tx.date}</td>
                    <td className="p-2 max-w-xs truncate">{tx.description}</td>
                    <td className={`p-2 text-right tabular-nums ${tx.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="p-2 flex gap-1">
                      {tx.isDuplicate && <Badge variant="outline" className="text-yellow-600 border-yellow-400 text-xs">Dup</Badge>}
                      {tx.isTransfer && <Badge variant="outline" className="text-xs">Xfer</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? "Importing…" : `Confirm Import (${preview.transactions.filter((t) => !t.isDuplicate || overrideDuplicates).length} rows)`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 3 — Done */}
      {step === 3 && result && (
        <div className="space-y-4 text-center py-8">
          <div className="text-4xl">✓</div>
          <h2 className="text-xl font-semibold">Import Complete</h2>
          <div className="flex justify-center gap-6 text-sm">
            <div><span className="font-semibold text-green-600">{result.imported}</span> imported</div>
            <div><span className="font-semibold text-yellow-600">{result.duplicatesSkipped}</span> duplicates skipped</div>
          </div>
          <p className="text-muted-foreground text-sm">Transactions are being categorized by AI in the background.</p>
          <Button onClick={() => router.push("/books/transactions")}>View Transactions</Button>
        </div>
      )}
    </div>
  );
}
