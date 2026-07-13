"use client";

import { useState } from "react";
import {
  downloadExecutiveReportPdf,
  type ExecutivePdfExportOptions,
} from "@/lib/client/executive-report-pdf";

type ExportManagementReviewButtonProps = {
  options?: ExecutivePdfExportOptions;
  className?: string;
  label?: string;
};

export function ExportManagementReviewButton({
  options,
  className = "rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500",
  label = "Export PDF",
}: ExportManagementReviewButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);

    try {
      await downloadExecutiveReportPdf(options);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Failed to export management review PDF.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className={className}
      >
        {exporting ? "Generating PDF..." : label}
      </button>
      {error ? (
        <p className="max-w-xs text-right text-xs text-red-300">{error}</p>
      ) : null}
    </div>
  );
}
