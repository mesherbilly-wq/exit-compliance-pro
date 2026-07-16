"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getPageTitle } from "@/lib/navigation";
import { BrandMark } from "./brand-mark";

type HeaderProps = {
  onMenuClick: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white lg:hidden"
        aria-label="Open navigation menu"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      <Link
        href="/"
        className="shrink-0 lg:hidden"
        aria-label="Fire Exit Intelligence Platform home"
      >
        <BrandMark logoHeight={32} compact />
      </Link>

      <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-white sm:text-xl">
        {title}
      </h1>

      <div className="hidden flex-1 sm:block sm:max-w-md">
        <input
          type="search"
          placeholder="Search..."
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Link
          href="/"
          className="hidden shrink-0 lg:block"
          aria-label="Fire Exit Intelligence Platform home"
        >
          <BrandMark logoHeight={28} compact className="flex flex-col items-end" />
        </Link>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          aria-label="Notifications"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-full bg-cyan-500 text-sm font-semibold text-slate-950"
          aria-label="User profile"
        >
          U
        </div>
      </div>
    </header>
  );
}
