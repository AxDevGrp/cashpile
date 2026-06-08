"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@cashpile/ui";

function readImportOptions() {
  try {
    const stored = window.localStorage.getItem("cashpile_plaid_import_options");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export default function PlaidOAuthResume() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [message, setMessage] = useState("Finishing secure bank connection…");
  const [error, setError] = useState<string | null>(null);
  const receivedRedirectUri = typeof window === "undefined" ? undefined : window.location.href;

  const importOptions = useMemo(() => {
    if (typeof window === "undefined") return {};
    return readImportOptions();
  }, []);

  useEffect(() => {
    const token = window.localStorage.getItem("cashpile_plaid_link_token");
    if (!token) {
      setError("Cashpile could not find the Plaid session to resume. Please start Connect Account again.");
      setMessage("Plaid session not found.");
      return;
    }
    setLinkToken(token);
  }, []);

  const onSuccess = useCallback(async (publicToken: string) => {
    setMessage("Saving connected account…");
    setError(null);
    try {
      const taxEntityId = window.localStorage.getItem("cashpile_plaid_tax_entity_id");
      const res = await fetch("/api/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token: publicToken,
          tax_entity_id: taxEntityId || undefined,
          import_options: importOptions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to connect account");
      window.localStorage.removeItem("cashpile_plaid_link_token");
      window.localStorage.removeItem("cashpile_plaid_import_options");
      window.localStorage.removeItem("cashpile_plaid_tax_entity_id");
      window.location.href = "/books/accounts";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect account");
      setMessage("Could not finish bank connection.");
    }
  }, [importOptions]);

  const { open, ready, error: plaidError } = usePlaidLink({
    token: linkToken ?? "",
    receivedRedirectUri,
    onSuccess,
    onExit: (err) => {
      if (err) setError(err.display_message ?? err.error_message ?? "Plaid Link was closed before connecting");
      setMessage("Plaid Link was closed.");
    },
  });

  useEffect(() => {
    if (plaidError) {
      setError((plaidError as any).display_message ?? (plaidError as any).error_message ?? "Plaid Link failed to resume");
      setMessage("Plaid Link failed to resume.");
    }
  }, [plaidError]);

  useEffect(() => {
    if (!ready || !linkToken) return;
    open();
  }, [linkToken, open, ready]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full rounded-xl border bg-card p-6 text-center space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Finishing Plaid Link</h1>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        <div className="flex justify-center gap-2">
          <Button onClick={() => ready && open()} disabled={!ready || !linkToken}>Resume Plaid</Button>
          <Link href="/books/accounts"><Button variant="outline">Back to Accounts</Button></Link>
        </div>
      </div>
    </div>
  );
}
