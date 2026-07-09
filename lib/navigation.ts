export type NavItem = {
  label: string;
  href: string;
  match?: "exact" | "prefix";
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", match: "exact" },
  { label: "Imports", href: "/imports", match: "prefix" },
  { label: "Door Intelligence", href: "/doors", match: "prefix" },
  { label: "Compliance Intelligence", href: "/compliance", match: "prefix" },
  { label: "Heat Maps", href: "/heat-maps", match: "prefix" },
  { label: "Trends", href: "/trends", match: "prefix" },
  { label: "Executive Reports", href: "/executive-reports", match: "prefix" },
  { label: "Settings", href: "/settings", match: "prefix" },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/imports": "Imports",
  "/imports/upload": "Upload CSV",
  "/imports/mapping": "Field Mapping",
  "/doors": "Door Intelligence",
  "/compliance": "Compliance Intelligence",
  "/heat-maps": "Heat Maps",
  "/trends": "Trends",
  "/executive-reports": "Executive Reports",
  "/settings": "Settings",
};

export function isNavActive(pathname: string, item: NavItem): boolean {
  const normalizedPath =
    pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;
  const normalizedHref =
    item.href !== "/" ? item.href.replace(/\/$/, "") : item.href;

  if (item.match === "exact") {
    return normalizedPath === normalizedHref;
  }

  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(`${normalizedHref}/`)
  );
}

export function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  const match = Object.entries(pageTitles)
    .filter(([path]) => path !== "/")
    .find(([path]) => pathname.startsWith(path));

  return match?.[1] ?? "Fire Exit Intelligence Platform";
}
