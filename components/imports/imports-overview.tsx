"use client";

import Link from "next/link";
import type { ImportRecord } from "@/lib/imports/types";
import { IMPORT_STATUS_LABELS } from "@/lib/imports/types";

type ImportStatusCardsProps = {
  imports: ImportRecord[];
};

export function ImportStatusCards({ imports }: ImportStatusCardsProps) {
  const readyForMapping = imports.filter(
    (item) => item.status === "ready_for_mapping",
  ).length;
  const mapped = imports.filter((item) => item.status === "mapped").length;
  const processed = imports.filter((item) => item.status === "processed").length;

  const cards = [
    { label: "Total imports", value: imports.length, accent: "text-white" },
    {
      label: "Ready for mapping",
      value: readyForMapping,
      accent: "text-cyan-400",
    },
    { label: "Mapped", value: mapped, accent: "text-amber-400" },
    { label: "Processed", value: processed, accent: "text-emerald-400" },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
        >
          <p className="text-sm text-slate-400">{card.label}</p>
          <p className={`mt-2 text-3xl font-bold ${card.accent}`}>{card.value}</p>
        </div>
      ))}
    </section>
  );
}

type RecentImportsTableProps = {
  imports: ImportRecord[];
  onDelete: (importId: string) => void;
};

export function RecentImportsTable({ imports, onDelete }: RecentImportsTableProps) {
  if (imports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <p className="text-sm text-slate-400">No imports yet.</p>
        <Link
          href="/imports/upload"
          className="mt-4 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Upload your first CSV
        </Link>
      </div>
    );
  }

  function handleDelete(item: ImportRecord) {
    const confirmed = window.confirm(
      `Delete "${item.fileName}"? This will remove the import and its stored CSV from the server.`,
    );

    if (confirmed) {
      onDelete(item.id);
    }
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-700 text-slate-300">
          <tr>
            <th className="px-4 py-3 font-medium">File name</th>
            <th className="px-4 py-3 font-medium">Rows</th>
            <th className="px-4 py-3 font-medium">Columns</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Uploaded</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((item) => (
            <tr key={item.id} className="border-b border-slate-800 last:border-0">
              <td className="px-4 py-3 font-medium text-white">{item.fileName}</td>
              <td className="px-4 py-3 text-slate-300">{item.rowCount}</td>
              <td className="px-4 py-3 text-slate-300">{item.columnCount}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-400 ring-1 ring-cyan-500/30">
                  {IMPORT_STATUS_LABELS[item.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-400">
                {new Date(item.uploadedAt).toLocaleString()}
              </td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-300"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
