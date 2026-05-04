"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@cashpile/ui";

interface Props {
  taxEntityId?: string; // NEW: Use tax_entity_id instead of udaId
  udaId?: string; // DEPRECATED: For backward compatibility
  onSuccess?: (institution: string) => void;
}

export default function PlaidLinkButton({ taxEntityId, udaId, onSuccess }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use the new taxEntityId if provided, fall back to deprecated udaId
  const entityId = taxEntityId ?? udaId;

  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
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
    }
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken ?? "",
    onSuccess: async (public_token) => {
      setLoading(true);
      try {
        const res = await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token, tax_entity_id: entityId }),
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
        onClick={linkToken && ready ? () => open() : fetchLinkToken}
        disabled={loading || (!!linkToken && !ready)}
      >
        {loading ? "Connecting…" : "Connect Account"}
      </Button>
      {error && <p className="text-xs text-destructive max-w-48">{error}</p>}
    </div>
  );
}
