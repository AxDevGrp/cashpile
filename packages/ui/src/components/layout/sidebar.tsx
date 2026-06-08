"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  Receipt,
  Settings,
  ChevronLeft,
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
  { href: "/cashboard", label: "Cashboard", icon: LayoutDashboard },
  { href: "/books", label: "Books", icon: BookOpen, moduleColor: "text-emerald-500" },
  { href: "/books/tax", label: "Taxes", icon: Receipt, moduleColor: "text-amber-500" },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  /** Desktop: whether the sidebar is pinned open (shows labels) */
  pinned?: boolean;
  onPin?: () => void;
  /** Mobile: drawer is open */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/books") {
    return pathname === "/books" || (pathname.startsWith("/books/") && !pathname.startsWith("/books/tax"));
  }
  return pathname === href || pathname.startsWith(href + "/");
}

function NavLink({
  item,
  pathname,
  onMobileClose,
  forMobile,
  pinned,
}: {
  item: NavItem;
  pathname: string;
  onMobileClose?: () => void;
  forMobile: boolean;
  pinned: boolean;
}) {
  const isActive = isNavItemActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onMobileClose}
      title={item.label}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors group/item",
        isActive
          ? "bg-emerald-50 text-emerald-800 shadow-sm"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
      )}
    >
      <Icon
        className={cn(
          "h-5 w-5 shrink-0",
          isActive ? "text-emerald-600" : item.moduleColor ?? ""
        )}
      />
      <span
        className={cn(
          "flex-1 truncate transition-all duration-200",
          forMobile
            ? "opacity-100 w-auto"
            : "opacity-0 w-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto",
          pinned && !forMobile && "opacity-100 w-auto"
        )}
      >
        {item.label}
      </span>
      {isActive && (
        <span
          className={cn(
            "w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 transition-all duration-200",
            forMobile ? "opacity-100" : "opacity-0 group-hover:opacity-100",
            pinned && !forMobile && "opacity-100"
          )}
        />
      )}
    </Link>
  );
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

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-slate-100 shrink-0 overflow-hidden">
        <Link
          href="/cashboard"
          onClick={onMobileClose}
          className="flex items-center gap-2.5 min-w-0"
        >
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-lg shadow-blue-500/15">
            C
          </div>
          <span
            className={cn(
              "font-black text-xl tracking-tight whitespace-nowrap transition-all duration-200 text-slate-950",
              forMobile ? "opacity-100 w-auto" : "opacity-0 w-0 group-hover:opacity-100 group-hover:w-auto",
              pinned && !forMobile && "opacity-100 w-auto"
            )}
          >
            Cashpile
          </span>
        </Link>
        {forMobile && (
          <button
            onClick={onMobileClose}
            className="ml-auto p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-5 px-3 space-y-2 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            onMobileClose={onMobileClose}
            forMobile={forMobile}
            pinned={pinned}
          />
        ))}
      </nav>

      {/* Pin toggle (desktop only) */}
      {!forMobile && onPin && (
        <div className="p-3 border-t border-slate-100 shrink-0">
          <button
            onClick={onPin}
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            className="w-full flex items-center justify-center p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950 transition-colors"
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
          "hidden lg:flex flex-col h-full bg-white/90 backdrop-blur-xl border-r border-slate-100",
          "transition-all duration-200 ease-in-out",
          "group hover:w-64",
          pinned ? "w-64" : "w-16"
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
          "fixed inset-y-0 left-0 z-50 flex flex-col w-72 bg-white border-r border-slate-100",
          "transition-transform duration-300 lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent pinned={true} forMobile={true} onMobileClose={onMobileClose} />
      </aside>
    </>
  );
}
