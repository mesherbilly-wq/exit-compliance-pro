"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ImportStatusCards,
  RecentImportsTable,
} from "@/components/imports/imports-overview";
import { getRecentImports } from "@/lib/imports/storage";
import type { ImportRecord } from "@/lib/imports/types";

export function ImportsPageContent() {
  const [imports, setImports] = useState<ImportRecord[]>([]);

  useEffect(() => {
    setImports(getRecentImports());
  }, []);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
            Imports
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            Genetec CSV Imports
          </h2>
          <p className="mt-4 max-w-3xl text-slate-300">
            Upload Genetec access-control exports, review recent imports, and
            prepare files for field mapping and reporting.
          </p>
        </div>

        <Link
          href="/imports/upload"
          className="inline-flex shrink-0 items-center justify-center rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Upload new CSV
        </Link>
      </div>

      <ImportStatusCards imports={imports} />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-xl font-semibold">Recent imports</h3>
          <Link
            href="/imports/upload"
            className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
          >
            Go to Genetec CSV upload →
          </Link>
        </div>

        <RecentImportsTable imports={imports} />
      </section>
    </div>
  );
}
