"use client";

import Link from "next/link";
import { useState } from "react";
import type { ApiImportRecord } from "@/lib/client/import-types";
import {
  downloadFailedImportCsv,
  fetchImportById,
  fetchImportProcessingLog,
  formatProcessingDuration,
  formatReportingPeriod,
  reprocessImportById,
} from "@/lib/client/imports-api";
import { IMPORT_STATUS_LABELS } from "@/lib/imports/types";
import type { ProcessingLogEntry } from "@/lib/server/types/import-management";

type ImportStatusCardsProps = {
  imports: ApiImportRecord[];
};

export function ImportStatusCards({ imports }: ImportStatusCardsProps) {
  const readyForMapping = imports.filter(
    (item) => item.status === "ready_for_mapping",
  ).length;
  const mapped = imports.filter((item) => item.status === "mapped").length;
  const processed = imports.filter((item) => item.status === "processed").length;
  const failed = imports.filter((item) => item.status === "failed").length;

  const cards = [
    { label: "Total imports", value: imports.length, accent: "text-white" },
    {
      label: "Ready for mapping",
      value: readyForMapping,
      accent: "text-cyan-400",
    },
    { label: "Mapped", value: mapped, accent: "text-amber-400" },
    { label: "Processed", value: processed, accent: "text-emerald-400" },
    { label: "Failed", value: failed, accent: "text-red-400" },
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
  imports: ApiImportRecord[];
  onDelete: (importId: string) => void;
  onRefresh: () => void;
};

function statusBadgeClass(status: ApiImportRecord["status"]): string {
  switch (status) {
    case "processed":
    case "mapped":
      return "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30";
    case "failed":
    case "rejected":
      return "bg-red-500/10 text-red-400 ring-red-500/30";
    case "ready_for_mapping":
      return "bg-amber-500/10 text-amber-400 ring-amber-500/30";
    case "processing":
      return "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30";
    default:
      return "bg-slate-500/10 text-slate-300 ring-slate-500/30";
  }
}

function ImportActionsMenu({
  item,
  onDelete,
  onRefresh,
}: {
  item: ApiImportRecord;
  onDelete: (importId: string) => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"view" | "log" | null>(null);
  const [viewData, setViewData] = useState<ApiImportRecord | null>(null);
  const [logData, setLogData] = useState<ProcessingLogEntry[]>([]);

  async function handleView() {
    setBusy(true);
    try {
      const record = await fetchImportById(item.id);
      setViewData(record);
      setModal("view");
      setOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to load import.");
    } finally {
      setBusy(false);
    }
  }

  async function handleViewLog() {
    setBusy(true);
    try {
      const result = await fetchImportProcessingLog(item.id);
      setLogData(result.processingLog);
      setModal("log");
      setOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to load log.");
    } finally {
      setBusy(false);
    }
  }

  async function handleReprocess() {
    const confirmed = window.confirm(
      `Reprocess "${item.fileName}"? This will rebuild analytics from stored data.`,
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    try {
      await reprocessImportById(item.id);
      onRefresh();
      setOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Reprocess failed.");
    } finally {
      setBusy(false);
    }
  }

  function handleDelete() {
    const confirmed = window.confirm(
      `Delete "${item.fileName}"? This will remove the import, all incidents, statistics, and compliance data.`,
    );

    if (confirmed) {
      onDelete(item.id);
      setOpen(false);
    }
  }

  async function handleDownloadFailedCsv() {
    setBusy(true);
    try {
      await downloadFailedImportCsv(item.id);
      setOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((current) => !current)}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800 disabled:opacity-50"
        >
          Actions ▾
        </button>

        {open ? (
          <div className="absolute right-0 z-20 mt-2 min-w-40 rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl">
            <button
              type="button"
              onClick={handleView}
              className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            >
              View
            </button>
            <button
              type="button"
              onClick={handleReprocess}
              className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            >
              Reprocess
            </button>
            <button
              type="button"
              onClick={handleViewLog}
              className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
            >
              View Log
            </button>
            {item.failedCsvAvailable ? (
              <button
                type="button"
                onClick={handleDownloadFailedCsv}
                className="block w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
              >
                Download CSV
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleDelete}
              className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>

      {modal === "view" && viewData ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="text-lg font-semibold text-white">{viewData.fileName}</h4>
                <p className="mt-1 text-sm text-slate-400">
                  {viewData.sourceLabel} · {IMPORT_STATUS_LABELS[viewData.status]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-sm text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-400">Reporting period</dt>
                <dd className="text-white">
                  {formatReportingPeriod(
                    viewData.reportingPeriodStart,
                    viewData.reportingPeriodEnd,
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Imported</dt>
                <dd className="text-white">
                  {new Date(viewData.importedDate).toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Sender</dt>
                <dd className="text-white">{viewData.sender ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Processing time</dt>
                <dd className="text-white">
                  {formatProcessingDuration(viewData.processingDurationMs)}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">Rows</dt>
                <dd className="text-white">{viewData.rowCount.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Doors</dt>
                <dd className="text-white">{viewData.doorCount}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Incidents</dt>
                <dd className="text-white">{viewData.incidentCount}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Compliance score</dt>
                <dd className="text-white">
                  {viewData.complianceScoreSnapshot ?? "—"}
                </dd>
              </div>
            </dl>

            {viewData.processingResult ? (
              <p className="mt-4 text-sm text-slate-300">{viewData.processingResult}</p>
            ) : null}
          </div>
        </div>
      ) : null}

      {modal === "log" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6">
            <div className="flex items-start justify-between gap-4">
              <h4 className="text-lg font-semibold text-white">Processing Log</h4>
              <button
                type="button"
                onClick={() => setModal(null)}
                className="text-sm text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {logData.length === 0 ? (
              <p className="mt-4 text-sm text-slate-400">No log entries recorded.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {logData.map((entry, index) => (
                  <li
                    key={`${entry.timestamp}-${index}`}
                    className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          entry.level === "error"
                            ? "text-red-400"
                            : entry.level === "warn"
                              ? "text-amber-400"
                              : "text-cyan-400"
                        }
                      >
                        {entry.level.toUpperCase()}
                      </span>
                      <span className="text-slate-500">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-200">{entry.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function RecentImportsTable({
  imports,
  onDelete,
  onRefresh,
}: RecentImportsTableProps) {
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

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-700 text-slate-300">
          <tr>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Source</th>
            <th className="px-4 py-3 font-medium">Reporting period</th>
            <th className="px-4 py-3 font-medium">Imported</th>
            <th className="px-4 py-3 font-medium">Doors</th>
            <th className="px-4 py-3 font-medium">Incidents</th>
            <th className="px-4 py-3 font-medium">Compliance</th>
            <th className="px-4 py-3 font-medium">Processing</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((item) => (
            <tr key={item.id} className="border-b border-slate-800 last:border-0">
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${statusBadgeClass(item.status)}`}
                >
                  {IMPORT_STATUS_LABELS[item.status]}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-300">{item.sourceLabel}</td>
              <td className="px-4 py-3 text-slate-300">
                {formatReportingPeriod(
                  item.reportingPeriodStart,
                  item.reportingPeriodEnd,
                )}
              </td>
              <td className="px-4 py-3 text-slate-400">
                {new Date(item.importedDate).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-slate-300">{item.doorCount}</td>
              <td className="px-4 py-3 text-slate-300">{item.incidentCount}</td>
              <td className="px-4 py-3 text-slate-300">
                {item.complianceScoreSnapshot ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-400">
                {formatProcessingDuration(item.processingDurationMs)}
              </td>
              <td className="px-4 py-3">
                <ImportActionsMenu
                  item={item}
                  onDelete={onDelete}
                  onRefresh={onRefresh}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
