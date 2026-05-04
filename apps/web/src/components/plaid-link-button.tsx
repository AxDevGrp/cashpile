"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cashpile/ui";

interface Props {
  taxEntityId?: string; // NEW: Use tax_entity_id instead of udaId
  udaId?: string; // DEPRECATED: For backward compatibility
  onSuccess?: (institution: string) => void;
}

type ImportPreset = "tax2025" | "last90" | "last730";
type DuplicateMode = "flag_review" | "keep_all";

export default function PlaidLinkButton({ taxEntityId, udaId, onSuccess }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [importPreset, setImportPreset] = useState<ImportPreset>("tax2025");
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("flag_review");

  // Use the new taxEntityId if provided, fall back to deprecated udaId
  const entityId = taxEntityId ?? udaId;
  const daysRequested = importPreset === "last90" ? 90 : 730;
  const importOptions = useMemo(
    () => ({
      preset: importPreset,
      days_requested: daysRequested,
      requested_date_from: importPreset === "tax2025" ? "2025-01-01" : null,
      requested_date_to: importPreset === "tax2025" ? "2025-12-31" : null,
      duplicate_mode: duplicateMode,
    }),
    [daysRequested, duplicateMode, importPreset]
  );

  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/link-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importOptions),
      });
      const data = await res.json();
      if (!res.ok || !data.link_token) {
        setError(data.error ?? "Failed to create Plaid Link token");
        return;
      }
      setLinkToken(data.link_token);
    } catch (err) {
      console.error("Failed to get link token", err);
      setError("Failed to connect to Plaid");
    } finally {
      setLoading(false);
      setOptionsOpen(false);
    }
  }, [importOptions]);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (public_token) => {
      setLoading(true);
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, tax_entity_id: entityId, import_options: importOptions }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Failed to connect account");
          return;
        }
        if (data.institution) {
          onSuccess?.(data.institution);
          window.location.reload();
        }
      } catch (err) {
        console.error("Failed to connect account", err);
        setError("Failed to connect account");
      } finally {
        setLoading(false);
      }
    },
    onExit: () => setLinkToken(null),
  });

  useEffect(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        size="sm"
        onClick={linkToken && ready ? () => open() : () => setOptionsOpen(true)}
        disabled={loading || (!!linkToken && !ready)}
      >
        {loading ? "Connecting…" : "Connect Account"}
      </Button>
      {error && <p className="text-xs text-destructive max-w-48">{error}</p>}

      <Dialog open={optionsOpen} onOpenChange={setOptionsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Plaid import options</DialogTitle>
            <DialogDescription>
              Choose how much history to request before connecting. Plaid can provide up to 24 months when the bank supports it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Transaction history</label>
              <Select value={importPreset} onValueChange={(value) => setImportPreset(value as ImportPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tax2025">Tax year 2025 — request max available history</SelectItem>
                  <SelectItem value="last730">Last 24 months — max available history</SelectItem>
                  <SelectItem value="last90">Last 90 days — faster import</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This will request {daysRequested} days from Plaid. For 2025 taxes, reconnecting after this setting is required if the item was already created with less history.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Duplicate handling</label>
              <Select value={duplicateMode} onValueChange={(value) => setDuplicateMode(value as DuplicateMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flag_review">Flag possible duplicates for review</SelectItem>
                  <SelectItem value="keep_all">Keep all imported transactions</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Cashpile will not auto-delete suspected duplicates. Exact Plaid transaction IDs are still deduped automatically.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOptionsOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={fetchLinkToken} disabled={loading}>
              {loading ? "Preparing…" : "Continue to Plaid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
