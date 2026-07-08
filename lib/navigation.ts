export type NavItem = {
  label: string;
  href: string;
  match?: "exact" | "prefix";
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", match: "exact" },
  { label: "Customers", href: "/customers", match: "prefix" },
  { label: "Sites", href: "/sites", match: "prefix" },
  { label: "Imports", href: "/imports", match: "prefix" },
  { label: "Reports", href: "/reports", match: "prefix" },
  { label: "Scheduled Reports", href: "/scheduled", match: "prefix" },
  { label: "Settings", href: "/settings", match: "prefix" },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/customers": "Customers",
  "/sites": "Sites",
  "/imports": "Imports",
  "/reports": "Reports",
  "/scheduled": "Scheduled Reports",
  "/settings": "Settings",
};

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.match === "exact") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) {
    return pageTitles[pathname];
  }

  const match = Object.entries(pageTitles)
    .filter(([path]) => path !== "/")
    .find(([path]) => pathname.startsWith(path));

  return match?.[1] ?? "Exit Compliance Pro";
}
