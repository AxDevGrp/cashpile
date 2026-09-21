import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronRight,
  LayoutGrid,
  Loader2,
  Lock,
  type LucideIcon,
} from "lucide-react";
import {
  isMobileNavigationItem,
  selectActiveNavigationHref,
  type UiV2Insight,
} from "./model";
import styles from "./ui-v2.module.css";

export interface UiV2NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  mobile?: boolean;
}

export function AppShellV2({
  children,
  navigation,
  pathname,
  mode = "preview",
  mainProps,
}: {
  children: React.ReactNode;
  navigation: UiV2NavigationItem[];
  pathname: string;
  mode?: "app" | "preview";
  mainProps?: React.ComponentPropsWithoutRef<"main"> & Record<`data-${string}`, string>;
}) {
  return (
    <div className={mode === "app" ? styles.appShell : styles.shell}>
      <a className={styles.skipLink} href={`#${mainProps?.id ?? "main-content"}`}>
        Skip to main content
      </a>
      <IconRail navigation={navigation} pathname={pathname} />
      <main
        {...mainProps}
        id={mainProps?.id ?? "main-content"}
        tabIndex={mainProps?.tabIndex ?? -1}
        className={
          mode === "app"
            ? `${styles.appMain}${mainProps?.className ? ` ${mainProps.className}` : ""}`
            : styles.main
        }
      >
        {children}
      </main>
      <MobileNavigation navigation={navigation} pathname={pathname} />
    </div>
  );
}

export function IconRail({
  navigation,
  pathname,
}: {
  navigation: UiV2NavigationItem[];
  pathname: string;
}) {
  const activeHref = selectActiveNavigationHref(navigation, pathname);

  return (
    <aside className={styles.rail} aria-label="Primary navigation">
      <Link className={styles.mark} href="/cashboard" aria-label="Cashpile home">
        <img src="/assets/gremlin-v3-crop.png" alt="" />
      </Link>
      <nav className={styles.railNav}>
        {navigation.map(({ href, label, icon: Icon }) => {
          const active = href === activeHref;
          return (
            <Link
              key={href}
              href={href}
              className={active ? styles.navActive : styles.navLink}
              aria-label={label}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function MobileNavigation({
  navigation,
  pathname,
}: {
  navigation: UiV2NavigationItem[];
  pathname: string;
}) {
  const mobileNavigation = navigation.filter(isMobileNavigationItem);
  const activeHref = selectActiveNavigationHref(mobileNavigation, pathname);

  return (
    <nav className={styles.mobileNav} aria-label="Primary navigation">
      {mobileNavigation.map(({ href, label, icon: Icon }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            className={active ? styles.mobileActive : styles.mobileLink}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function VisualAction({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}) {
  return (
    <Link className={styles.visualAction} href={href}>
      <Icon size={30} strokeWidth={1.65} aria-hidden="true" />
      <span>
        <strong>{label}</strong>
        {description && <small>{description}</small>}
      </span>
      <ChevronRight size={17} aria-hidden="true" />
    </Link>
  );
}

export function PriorityInsight({
  insight,
  actionHref,
}: {
  insight?: UiV2Insight;
  actionHref?: string;
}) {
  if (!insight) return null;
  return (
    <section
      className={`${styles.insight} ${styles[`insight${insight.severity}`]}`}
      aria-labelledby={`insight-${insight.id}`}
    >
      <div>
        <span className={styles.eyebrow}>Cash noticed</span>
        <h2 id={`insight-${insight.id}`}>{insight.title}</h2>
        {insight.detail && <p>{insight.detail}</p>}
      </div>
      {insight.actionLabel && actionHref && (
        <Link href={actionHref}>
          {insight.actionLabel}
          <ChevronRight size={16} />
        </Link>
      )}
    </section>
  );
}

export function ModuleDock({ children }: { children: React.ReactNode }) {
  return (
    <nav className={styles.moduleDock} aria-label="Your modules">
      {children}
    </nav>
  );
}

export function ModuleEntrance({
  href,
  label,
  description,
  icon: Icon,
}: {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
}) {
  return (
    <Link className={styles.moduleEntrance} href={href}>
      <Icon size={22} aria-hidden="true" />
      <strong>{label}</strong>
      {description && <span className={styles.srOnly}>{description}</span>}
    </Link>
  );
}

export function WorkspaceHeader({
  eyebrow,
  title,
  detail,
  actions,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={styles.header}>
      <div>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1>{title}</h1>
        {detail && <p>{detail}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}

export function LoadingState({
  label = "Cash is preparing your workspace",
}: {
  label?: string;
}) {
  return (
    <div className={styles.state} role="status">
      <Loader2 className={styles.spinner} size={22} aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={styles.state} role="status" aria-live="polite">
      <LayoutGrid size={22} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{detail}</p>
      {action}
    </section>
  );
}

export function ErrorState({
  title = "Something needs another look",
  detail,
  action,
}: {
  title?: string;
  detail: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={styles.state} role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <h2>{title}</h2>
      <p>{detail}</p>
      {action}
    </section>
  );
}

export function UnauthorizedState({
  title = "This workspace is private",
  detail = "Sign in with the account that has access to continue.",
  action,
}: {
  title?: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={styles.state} aria-labelledby="unauthorized-state-title">
      <Lock size={22} aria-hidden="true" />
      <h2 id="unauthorized-state-title">{title}</h2>
      <p>{detail}</p>
      {action}
    </section>
  );
}
