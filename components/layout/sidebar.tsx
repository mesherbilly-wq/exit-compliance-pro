"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isNavActive, navItems } from "@/lib/navigation";

type SidebarProps = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full flex-col border-r border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="block"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
            Exit Compliance
          </p>
          <p className="mt-1 text-lg font-bold text-white">Pro</p>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
