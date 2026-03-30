"use client";

import * as React from "react";
import { Bell, Menu } from "lucide-react";
import { cn } from "../../lib/utils";

interface TopNavProps {
  title?: string;
  className?: string;
  onMenuClick?: () => void;
  unreadAlerts?: number;
}

export function TopNav({ title, className, onMenuClick, unreadAlerts }: TopNavProps) {
  return (
    <header className={cn("flex h-16 items-center gap-3 border-b bg-background px-4 lg:px-6 shrink-0", className)}>
      {/* Hamburger — mobile only */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-md text-muted-foreground hover:bg-accent transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {title && <h1 className="text-lg font-semibold truncate">{title}</h1>}

      <div className="flex items-center gap-2 ml-auto">
        {unreadAlerts != null && unreadAlerts > 0 && (
          <span className="text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded-full font-medium">
            {unreadAlerts > 99 ? "99+" : unreadAlerts}
          </span>
        )}
        <button
          className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
          aria-label="Alerts"
        >
          <Bell className="h-5 w-5" />
          {unreadAlerts != null && unreadAlerts > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-violet-600" />
          )}
        </button>
      </div>
    </header>
  );
}
