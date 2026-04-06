"use client";

import { useCallback, useState } from "react";
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

  // Use the new taxEntityId if provided, fall back to deprecated udaId
  const entityId = taxEntityId ?? udaId;

  const fetchLinkToken = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json();
      setLinkToken(data.link_token);
    } catch (err) {
      console.error("Failed to get link token", err);
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
          body: JSON.stringify({ public_token, tax_entity_id: entityId, uda_id: entityId }),
        });
        const data = await res.json();
        if (data.institution) {
          onSuccess?.(data.institution);
          window.location.reload();
        }
      } catch (err) {
        console.error("Failed to connect account", err);
      } finally {
        setLoading(false);
      }
    },
    onExit: () => setLinkToken(null),
  });

  const handleClick = useCallback(async () => {
    if (!linkToken) {
      await fetchLinkToken();
    } else if (ready) {
      open();
    }
  }, [linkToken, ready, open, fetchLinkToken]);

  // Auto-open when token is ready
  const handleTokenReady = useCallback(() => {
    if (linkToken && ready) open();
  }, [linkToken, ready, open]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={linkToken && ready ? () => open() : fetchLinkToken}
      disabled={loading || (!!linkToken && !ready)}
    >
      {loading ? "Connecting…" : "Connect Account"}
    </Button>
  );
}
