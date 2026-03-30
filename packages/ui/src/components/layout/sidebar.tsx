"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Activity,
  Bot,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  moduleColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/books",     label: "Books",     icon: BookOpen,       moduleColor: "text-emerald-500" },
  { href: "/trades",    label: "Trades",    icon: TrendingUp,     moduleColor: "text-blue-500" },
  { href: "/pulse",     label: "Pulse",     icon: Activity,       moduleColor: "text-violet-500" },
  { href: "/ai",        label: "AI Assistant", icon: Bot },
  { href: "/settings",  label: "Settings",  icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ collapsed = false, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className={cn("flex flex-col h-full bg-background border-r transition-all duration-300", collapsed ? "w-16" : "w-60")}>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b">
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm mx-auto">C</div>
        ) : (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">C</div>
            <span className="font-bold text-lg tracking-tight">Cashpile</span>
          </Link>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, moduleColor }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center"
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && moduleColor)} />
              {!collapsed && <span className="flex-1">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-accent transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
