export type UiV2InsightSeverity = "critical" | "attention" | "info";

export interface UiV2Insight {
  id: string;
  severity: UiV2InsightSeverity;
  title: string;
  detail?: string;
  actionLabel?: string;
}

export interface UiV2AppNavigationItem {
  href: string;
  label: string;
  mobile: boolean;
}

const UI_V2_TRUTHY_VALUES = new Set(["1", "true", "yes", "on"]);
const severityRank: Record<UiV2InsightSeverity, number> = {
  critical: 0,
  attention: 1,
  info: 2,
};

export function isUiV2Enabled(value = process.env.NEXT_PUBLIC_UI_V2): boolean {
  return (
    typeof value === "string" &&
    UI_V2_TRUTHY_VALUES.has(value.trim().toLowerCase())
  );
}

export function matchesNavigationPath(href: string, pathname: string): boolean {
  if (href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getAppNavigation(showTaxModule: boolean): UiV2AppNavigationItem[] {
  return [
    { href: "/cashboard", label: "Home", mobile: true },
    { href: "/ai", label: "Ask Cash", mobile: true },
    { href: "/cashflow", label: "Activity", mobile: true },
    { href: "/books", label: "Books", mobile: true },
    ...(showTaxModule
      ? [{ href: "/books/tax", label: "Tax", mobile: false }]
      : []),
    { href: "/settings", label: "Settings", mobile: true },
    { href: "/pulse/alerts", label: "Notifications", mobile: false },
  ];
}

export function selectActiveNavigationHref(
  navigation: Pick<UiV2AppNavigationItem, "href">[],
  pathname: string,
): string | undefined {
  return navigation.reduce<string | undefined>((activeHref, { href }) => {
    if (!matchesNavigationPath(href, pathname)) return activeHref;
    if (!activeHref || href.length > activeHref.length) return href;
    return activeHref;
  }, undefined);
}

export function isMobileNavigationItem<T extends { mobile?: boolean }>(item: T): boolean {
  return item.mobile !== false;
}

export function selectPriorityInsight<T extends UiV2Insight>(
  insights: T[],
): T | undefined {
  return insights.reduce<T | undefined>((selected, insight) => {
    if (
      !selected ||
      severityRank[insight.severity] < severityRank[selected.severity]
    )
      return insight;
    return selected;
  }, undefined);
}
