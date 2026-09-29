"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";

interface Connection {
  id: string;
  name: string;
  scopes: string[];
  status: string;
  createdAt: string | null;
  lastUsedAt: string | null;
}

function formatWhen(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "never" : date.toLocaleString();
}

export default function AgentConnectionsPanel() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/connections", { headers: { Accept: "application/json" } });
      if (res.status === 403) {
        setForbidden(true);
        setConnections([]);
        return;
      }
      if (!res.ok) throw new Error("load failed");
      const body = await res.json();
      setConnections(body.connections ?? []);
      setForbidden(false);
    } catch {
      toast.error("Could not load agent connections");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const res = await fetch("/api/agent/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 403) {
        setForbidden(true);
        toast.error("Agent connections are not enabled for this account");
        return;
      }
      if (!res.ok) {
        const code = body?.error?.code;
        toast.error(code === "limit_reached" ? "You already have 10 active connections" : "Could not create connection");
        return;
      }
      setNewToken(body.token);
      setName("");
      setCopied(false);
      void load();
    } catch {
      toast.error("Could not create connection");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      const res = await fetch(`/api/agent/connections/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("revoke failed");
      toast.success("Connection revoked");
      void load();
    } catch {
      toast.error("Could not revoke connection");
    }
  }

  async function copyToken() {
    if (!newToken) return;
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
    } catch {
      toast.error("Copy failed — select the token manually");
    }
  }

  return (
    <section className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4" />
        <h2 className="font-semibold text-base">Agent connections</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Read-only access to your five Cashboard summary metrics. A connection cannot read transactions, account
        details, or change anything. Copy the token to your agent once — it is never shown again.
      </p>

      {forbidden ? (
        <p className="text-sm text-muted-foreground">Agent connections are available on the consumer experience only.</p>
      ) : (
        <>
          {newToken && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
              <p className="text-xs font-medium text-amber-900">
                Copy this token now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-white px-2 py-1 text-xs">{newToken}</code>
                <button
                  onClick={copyToken}
                  className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium" htmlFor="agentName">New connection name</label>
              <input
                id="agentName"
                type="text"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. My assistant"
                className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
              className="h-9 bg-primary text-primary-foreground px-4 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>

          <div className="space-y-2">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : connections.length === 0 ? (
              <p className="text-sm text-muted-foreground">No agent connections yet.</p>
            ) : (
              connections.map((connection) => (
                <div key={connection.id} className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{connection.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {connection.scopes.join(", ") || "no scopes"} · {connection.status}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Last used {formatWhen(connection.lastUsedAt)}
                    </p>
                  </div>
                  {connection.status === "active" ? (
                    <button
                      onClick={() => handleRevoke(connection.id)}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Revoke
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground shrink-0 mt-0.5">Revoked</span>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
