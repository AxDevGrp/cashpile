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
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  moduleColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/cashboard",  label: "Cashboard",    icon: LayoutDashboard },
  { href: "/books",      label: "Books",        icon: BookOpen,   moduleColor: "text-emerald-500" },
  { href: "/trades",     label: "Trades",       icon: TrendingUp, moduleColor: "text-blue-500" },
  { href: "/pulse",      label: "Pulse",        icon: Activity,   moduleColor: "text-violet-500" },
  { href: "/ai",         label: "AI Assistant", icon: Bot },
  { href: "/settings",   label: "Settings",     icon: Settings },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  /** Mobile: drawer is open */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavContent({
  collapsed,
  onMobileClose,
}: {
  collapsed: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b shrink-0">
        {collapsed ? (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm mx-auto">
            C
          </div>
        ) : (
          <Link
            href="/cashboard"
            className="flex items-center gap-2"
            onClick={onMobileClose}
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
              C
            </div>
            <span className="font-bold text-lg tracking-tight">Cashpile</span>
          </Link>
        )}
        {/* Mobile close button */}
        {onMobileClose && !collapsed && (
          <button
            onClick={onMobileClose}
            className="ml-auto p-1 rounded-md text-muted-foreground hover:bg-accent lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, moduleColor }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed && "justify-center"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive && moduleColor
                )}
              />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {!collapsed && isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Desktop collapse toggle */}
      <div className="p-2 border-t shrink-0 hidden lg:block">
        <button
          onClick={undefined /* controlled externally */}
          className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-accent transition-colors"
          data-collapse-toggle
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </>
  );
}

export function Sidebar({
  collapsed = false,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-full bg-background border-r transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
        onClick={(e) => {
          const btn = (e.target as HTMLElement).closest("[data-collapse-toggle]");
          if (btn) onToggle?.();
        }}
      >
        <NavContent collapsed={collapsed} />
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-background border-r transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent collapsed={false} onMobileClose={onMobileClose} />
      </aside>
    </>
  );
}
