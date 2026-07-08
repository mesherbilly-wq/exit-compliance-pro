export type NavItem = {
  label: string;
  href: string;
  match?: "exact" | "prefix";
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", match: "exact" },
  { label: "Imports", href: "/imports", match: "prefix" },
  { label: "Doors", href: "/doors", match: "prefix" },
  { label: "Compliance", href: "/compliance", match: "prefix" },
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
  "/doors": "Doors",
  "/compliance": "Compliance",
  "/heat-maps": "Heat Maps",
  "/trends": "Trends",
  "/executive-reports": "Executive Reports",
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

  return match?.[1] ?? "Fire Exit Compliance Pro";
}
