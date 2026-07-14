export type NavItem = {
  label: string;
  href: string;
  match?: "exact" | "prefix";
  activePaths?: string[];
};

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/", match: "exact", activePaths: ["/compliance"] },
  { label: "Attention Centre", href: "/attention", match: "prefix" },
  {
    label: "Doors",
    href: "/doors",
    match: "prefix",
    activePaths: ["/heat-maps"],
  },
  { label: "Trends", href: "/trends", match: "prefix" },
  { label: "Reports", href: "/executive-reports", match: "prefix" },
  { label: "Imports", href: "/imports", match: "prefix" },
  { label: "Settings", href: "/settings", match: "prefix" },
];

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/compliance": "Dashboard",
  "/attention": "Attention Centre",
  "/imports": "Imports",
  "/imports/upload": "Upload CSV",
  "/imports/mapping": "Field Mapping",
  "/doors": "Doors",
  "/heat-maps": "Heat Maps",
  "/trends": "Trends",
  "/executive-reports": "Management Review",
  "/settings": "Settings",
};

function normalizePath(pathname: string): string {
  return pathname !== "/" ? pathname.replace(/\/$/, "") : pathname;
}

export function isNavActive(pathname: string, item: NavItem): boolean {
  const normalizedPath = normalizePath(pathname);
  const normalizedHref =
    item.href !== "/" ? normalizePath(item.href) : item.href;

  if (item.activePaths?.includes(normalizedPath)) {
    return true;
  }

  if (item.match === "exact") {
    return normalizedPath === normalizedHref;
  }

  return (
    normalizedPath === normalizedHref ||
    normalizedPath.startsWith(`${normalizedHref}/`)
  );
}

export function getPageTitle(pathname: string): string {
  const normalizedPath = normalizePath(pathname);

  if (pageTitles[normalizedPath]) {
    return pageTitles[normalizedPath];
  }

  if (normalizedPath.startsWith("/doors/") && normalizedPath !== "/doors") {
    try {
      const doorSegment = normalizedPath.slice("/doors/".length);
      return decodeURIComponent(doorSegment);
    } catch {
      return "Door Profile";
    }
  }

  if (normalizedPath === "/executive-reports") {
    return "Management Review";
  }

  const match = Object.entries(pageTitles)
    .filter(([path]) => path !== "/")
    .find(([path]) => normalizedPath.startsWith(path));

  return match?.[1] ?? "Fire Exit Intelligence Platform";
}

export function isDoorsSectionPath(pathname: string): boolean {
  const normalizedPath = normalizePath(pathname);
  return (
    normalizedPath === "/doors" ||
    normalizedPath.startsWith("/doors/") ||
    normalizedPath === "/heat-maps"
  );
}
