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
  const [openedToken, setOpenedToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
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
      setOpenedToken(null);
      window.localStorage.setItem("cashpile_plaid_link_token", data.link_token);
      window.localStorage.setItem("cashpile_plaid_import_options", JSON.stringify(importOptions));
      if (entityId) window.localStorage.setItem("cashpile_plaid_tax_entity_id", entityId);
      else window.localStorage.removeItem("cashpile_plaid_tax_entity_id");
    } catch (err) {
      console.error("Failed to get link token", err);
      setError("Failed to connect to Plaid");
    } finally {
      setLoading(false);
      setOptionsOpen(false);
    }
  }, [importOptions]);


  const { open, ready, error: plaidLinkError } = usePlaidLink({
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
          window.localStorage.removeItem("cashpile_plaid_link_token");
          window.localStorage.removeItem("cashpile_plaid_import_options");
          window.localStorage.removeItem("cashpile_plaid_tax_entity_id");
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
    onExit: (err) => {
      if (err) setError(err.display_message ?? err.error_message ?? "Plaid Link was closed before connecting");
      setLinkToken(null);
      setOpenedToken(null);
      setLoading(false);
      setOpening(false);
    },
    onEvent: (eventName) => {
      if (eventName === "OPEN") setOpening(false);
    },
  });

  const handleOpenPlaid = useCallback(() => {
    if (!ready || !linkToken) return;
    setOpening(true);
    setOpenedToken(linkToken);
    setError(null);
    try {
      open();
      window.setTimeout(() => setOpening(false), 4000);
    } catch (err) {
      console.error("Failed to open Plaid Link", err);
      setOpening(false);
      setOpenedToken(null);
      setError("Plaid Link did not open. Try Retry, or connect again in Chrome/Safari if this browser stalls.");
    }
  }, [linkToken, open, ready]);

  useEffect(() => {
    if (plaidLinkError) {
      setError((plaidLinkError as any).display_message ?? (plaidLinkError as any).error_message ?? "Plaid Link failed to load");
      setLoading(false);
      setOpening(false);
      setOpenedToken(null);
      setLinkToken(null);
    }
  }, [plaidLinkError]);

  useEffect(() => {
    if (linkToken && ready && openedToken !== linkToken) {
      handleOpenPlaid();
    }
  }, [handleOpenPlaid, linkToken, openedToken, ready]);

  useEffect(() => {
    if (!linkToken || ready) return;
    const timeout = window.setTimeout(() => {
      setError("Plaid Link is taking too long to load. Check popup/content blockers and try again.");
      setLoading(false);
      setOpening(false);
      setOpenedToken(null);
      setLinkToken(null);
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [linkToken, ready]);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        {!linkToken && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOptionsOpen(true)}
            disabled={loading}
          >
            {loading ? "Preparing Plaid…" : "Connect Account"}
          </Button>
        )}
        {linkToken && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpenedToken(null);
                handleOpenPlaid();
              }}
              disabled={!ready || loading || opening}
            >
              {opening ? "Opening Plaid…" : ready ? "Retry Plaid Link" : "Loading Plaid…"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLinkToken(null);
                setOpenedToken(null);
                setLoading(false);
                setOpening(false);
                setError(null);
              }}
            >
              Reset
            </Button>
          </>
        )}
      </div>
      {linkToken && (
        <p className="text-xs text-muted-foreground max-w-64">
          {ready
            ? "Plaid should open automatically. If it does not, click Retry Plaid Link or use Chrome/Safari."
            : "Loading Plaid…"}
        </p>
      )}
      {error && <p className="text-xs text-destructive max-w-64">{error}</p>}

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
