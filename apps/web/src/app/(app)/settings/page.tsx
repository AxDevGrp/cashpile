import { TopNav, PageHeader } from "@cashpile/ui";

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <TopNav title="Settings" />
      <div className="p-6 max-w-3xl mx-auto w-full">
        <PageHeader title="Settings" description="Manage your account and preferences" />
        <div className="space-y-4">
          {["Profile", "Notifications", "Billing", "API Keys", "Integrations"].map((section) => (
            <div key={section} className="bg-background rounded-xl border p-5">
              <div className="font-medium text-sm mb-1">{section}</div>
              <div className="text-xs text-muted-foreground">Configure {section.toLowerCase()} settings</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
