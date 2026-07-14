"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isDoorsSectionPath } from "@/lib/navigation";

const tabs = [
  { label: "Door Register", href: "/doors" },
  { label: "Heat Maps", href: "/heat-maps" },
] as const;

export function DoorsSectionNav() {
  const pathname = usePathname();

  if (!isDoorsSectionPath(pathname)) {
    return null;
  }

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-1">
      {tabs.map((tab) => {
        const active =
          tab.href === "/doors"
            ? pathname === "/doors" || pathname.startsWith("/doors/")
            : pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-500/30"
                : "text-slate-400 hover:bg-slate-900 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
