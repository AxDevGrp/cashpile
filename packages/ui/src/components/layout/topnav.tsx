"use client";

import * as React from "react";
import { Bell, Search } from "lucide-react";
import { cn } from "../../lib/utils";

interface TopNavProps {
  title?: string;
  className?: string;
}

export function TopNav({ title, className }: TopNavProps) {
  return (
    <header className={cn("flex h-16 items-center gap-4 border-b bg-background px-6", className)}>
      {title && <h1 className="text-lg font-semibold">{title}</h1>}
      <div className="flex-1 flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="search"
            placeholder="Search..."
            className="flex h-9 w-full rounded-md border border-input bg-muted/50 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 ml-auto">
        <button className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors">
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
