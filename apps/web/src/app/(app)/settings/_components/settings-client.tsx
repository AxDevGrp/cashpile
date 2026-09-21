"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "../actions";

interface Props {
  profile: {
    email: string;
    display_name: string;
    preferred_currency: string;
  };
}

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CHF", "SGD", "MXN", "BRL"];

export default function SettingsClient({ profile }: Props) {
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
            <p className="text-xs text-muted-foreground">Used across Cashpile displays</p>
          </div>
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
