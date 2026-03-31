"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
  Pin,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  moduleColor?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/cashboard", label: "Cashboard",  icon: LayoutDashboard },
  { href: "/books",     label: "Books",      icon: BookOpen,   moduleColor: "text-emerald-500" },
  { href: "/trades",    label: "Trades",     icon: TrendingUp, moduleColor: "text-blue-500" },
  { href: "/pulse",     label: "Pulse",      icon: Activity,   moduleColor: "text-violet-500" },
  { href: "/settings",  label: "Settings",   icon: Settings },
];

interface SidebarProps {
  /** Desktop: whether the sidebar is pinned open (shows labels) */
  pinned?: boolean;
  onPin?: () => void;
  /** Mobile: drawer is open */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function NavContent({
  pinned,
  onPin,
  onMobileClose,
  forMobile = false,
}: {
  pinned: boolean;
  onPin?: () => void;
  onMobileClose?: () => void;
  forMobile?: boolean;
}) {
  const pathname = usePathname();
  // On desktop, labels show when pinned OR when hovering (via CSS group-hover)
  // The `showLabel` logic only applies for the static mobile drawer
  const showLabel = forMobile || pinned;

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-16 px-3 border-b shrink-0 overflow-hidden">
        <Link
          href="/cashboard"
          onClick={onMobileClose}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 via-blue-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
            C
          </div>
          {/* Desktop: fade-in on hover via group-hover; always show on mobile/pinned */}
          <span
            className={cn(
              "font-bold text-lg tracking-tight whitespace-nowrap transition-all duration-200",
              forMobile ? "opacity-100 w-auto" : "opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto",
              pinned && !forMobile && "opacity-100 w-auto"
            )}
          >
            Cashpile
          </span>
        </Link>
        {/* Mobile close */}
        {forMobile && (
          <button
            onClick={onMobileClose}
            className="ml-auto p-1.5 rounded-md text-muted-foreground hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon, moduleColor }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              onClick={onMobileClose}
              title={label}
              className={cn(
                "flex items-center gap-3 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-colors group/item",
                isActive
                  ? "bg-accent/80 text-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive && moduleColor ? moduleColor : ""
                )}
              />
              {/* Label: static on mobile/pinned, hover-reveal on desktop unpinned */}
              <span
                className={cn(
                  "flex-1 truncate transition-all duration-200",
                  forMobile
                    ? "opacity-100 w-auto"
                    : "opacity-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto",
                  pinned && !forMobile && "opacity-100 w-auto"
                )}
              >
                {label}
              </span>
              {/* Active dot */}
              {isActive && (
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full bg-primary shrink-0 transition-all duration-200",
                    forMobile
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100",
                    pinned && !forMobile && "opacity-100"
                  )}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Pin toggle (desktop only) */}
      {!forMobile && onPin && (
        <div className="p-2 border-t shrink-0">
          <button
            onClick={onPin}
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className="w-full flex items-center justify-center p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            {pinned ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <Pin className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  pinned = false,
  onPin,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar — icon-only by default, hover expands via CSS group */}
      <aside
        className={cn(
          "hidden lg:flex flex-col h-full bg-background/95 border-r",
          "transition-all duration-200 ease-in-out",
          "group hover:w-56",
          pinned ? "w-56" : "w-14"
        )}
      >
        <NavContent pinned={pinned} onPin={onPin} />
      </aside>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-background border-r",
          "transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent pinned={true} forMobile={true} onMobileClose={onMobileClose} />
      </aside>
    </>
  );
}
