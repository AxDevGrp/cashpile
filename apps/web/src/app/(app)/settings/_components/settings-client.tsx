"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { updateProfile } from "../actions";

interface Props {
  profile: {
    email: string;
    display_name: string;
    preferred_currency: string;
  };
  integrations: {
    mirofish: boolean;
    openai: boolean;
  };
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SGD", "MXN", "BRL"];

export default function SettingsClient({ profile, integrations }: Props) {
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [currency, setCurrency] = useState(profile.preferred_currency);
  const [, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);
    startTransition(async () => {
      try {
        await updateProfile({ display_name: displayName, preferred_currency: currency });
        toast.success("Settings saved");
      } catch (err) {
        toast.error("Failed to save settings");
        console.error(err);
      } finally {
        setSaving(false);
      }
    });
  }

  const isDirty = displayName !== profile.display_name || currency !== profile.preferred_currency;

  return (
    <div className="space-y-6">
      {/* Profile */}
      <section className="rounded-xl border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base">Profile</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={profile.email}
              readOnly
              className="w-full h-9 rounded-md border bg-muted px-3 text-sm text-muted-foreground cursor-not-allowed"
            />
            <p className="text-xs text-muted-foreground">Managed through your auth provider</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </section>

      {/* Preferences */}
      <section className="rounded-xl border bg-card p-6 space-y-5">
        <h2 className="font-semibold text-base">Preferences</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="currency">Default Currency</label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-9 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Used across Books and Trades displays</p>
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-base">Integrations</h2>
        <div className="space-y-3">
          {[
            {
              name: "OpenAI",
              key: "openai",
              desc: "Powers Pulse event analysis and Books categorization",
              active: integrations.openai,
              docsUrl: "https://platform.openai.com/api-keys",
              envKey: "OPENAI_API_KEY",
            },
            {
              name: "MiroFish",
              key: "mirofish",
              desc: "Multi-agent market impact simulation engine",
              active: integrations.mirofish,
              docsUrl: "https://github.com/666ghj/MiroFish",
              envKey: "MIROFISH_URL",
            },
          ].map(({ name, desc, active, docsUrl, envKey }) => (
            <div key={name} className="flex items-start justify-between gap-4 py-3 border-b last:border-0">
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {active ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                  {!active && (
                    <p className="text-xs text-yellow-600 mt-0.5">
                      Set <code className="font-mono bg-muted px-1 rounded">{envKey}</code> in your environment
                    </p>
                  )}
                </div>
              </div>
              <a
                href={docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 mt-0.5"
              >
                Docs <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Modules */}
      <section className="rounded-xl border bg-card p-6 space-y-3">
        <h2 className="font-semibold text-base">Modules</h2>
        <div className="space-y-2">
          {[
            { name: "Books", color: "bg-emerald-500", desc: "Personal & small business accounting", enabled: true },
            { name: "Trades", color: "bg-blue-500", desc: "Prop firm trade journal & performance", enabled: true },
            { name: "Pulse", color: "bg-violet-500", desc: "AI-powered global market intelligence", enabled: true },
          ].map(({ name, color, desc, enabled }) => (
            <div key={name} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <div>
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                {enabled ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Save */}
      {isDirty && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
