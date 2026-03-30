"use client";

import { useState } from "react";
import { Sidebar } from "@cashpile/ui";
import { Toaster } from "sonner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-muted/20">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main className="flex-1 overflow-y-auto">{children}</main>
      <Toaster richColors position="top-right" />
    </div>
  );
}
