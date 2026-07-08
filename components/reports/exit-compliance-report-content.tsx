"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import {
  analyzeExitCompliance,
  canRunExitComplianceAnalysis,
} from "@/lib/reports/analyze-exit-compliance";
import type { ExitComplianceAnalysis } from "@/lib/reports/analyze-exit-compliance";
import { getReportBySlug } from "@/lib/reports/config";
import {
  getFieldMapping,
  getLatestImport,
  getLatestImportData,
} from "@/lib/imports/storage";
import type { FieldMapping, ImportRecord } from "@/lib/imports/types";

const report = getReportBySlug("exit-compliance")!;

export function ExitComplianceReportContent() {
  const [importRecord, setImportRecord] = useState<ImportRecord | null>(null);
  const [mapping, setMapping] = useState<FieldMapping | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const latest = getLatestImport();
    setImportRecord(latest);
    setMapping(latest ? getFieldMapping(latest.id) : null);
    setLoaded(true);
  }, []);

  const rows = useMemo(() => getLatestImportData(), [loaded, importRecord]);

  const analysis = useMemo<ExitComplianceAnalysis | null>(() => {
    if (!mapping || !canRunExitComplianceAnalysis(rows, mapping)) {
      return null;
    }

    return analyzeExitCompliance(rows, mapping);
  }, [rows, mapping]);

  if (!loaded) {
    return (
      <ReportPageShell report={report}>
        <p className="text-sm text-slate-400">Loading report...</p>
      </ReportPageShell>
    );
  }

  if (!analysis || !importRecord) {
    return (
      <ReportPageShell report={report}>
        <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
          <h3 className="text-lg font-semibold">Import required</h3>
          <p className="mt-3 text-sm text-slate-400">
            Upload a Genetec CSV and complete field mapping to run exit
            compliance analysis.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/imports/upload"
              className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
            >
              Upload CSV
            </Link>
            <Link
              href="/imports/mapping"
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-cyan-500"
            >
              Field mapping
            </Link>
          </div>
        </section>
      </ReportPageShell>
    );
  }

  const statCards = [
    { label: "Total events", value: analysis.totalEvents, accent: "text-white" },
    { label: "Unique doors", value: analysis.uniqueDoors, accent: "text-cyan-400" },
    {
      label: "Forced open",
      value: analysis.forcedOpenEvents,
      accent: "text-red-400",
    },
    {
      label: "Held open",
      value: analysis.heldOpenEvents,
      accent: "text-amber-400",
    },
    {
      label: "Access denied",
      value: analysis.accessDeniedEvents,
      accent: "text-orange-400",
    },
  ];

  return (
    <ReportPageShell report={report}>
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold">Source import</h3>
        <p className="mt-2 text-sm text-slate-400">
          Analysing{" "}
          <span className="font-medium text-white">{importRecord.fileName}</span>{" "}
          · {importRecord.rowCount.toLocaleString()} rows
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.accent}`}>
              {card.value.toLocaleString()}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold">Top doors by activity</h3>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-700 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Door</th>
                <th className="px-4 py-3 font-medium">Events</th>
              </tr>
            </thead>
            <tbody>
              {analysis.doorBreakdown.map((item) => (
                <tr key={item.door} className="border-b border-slate-800">
                  <td className="px-4 py-3 text-white">{item.door}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {item.count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold">Recent compliance exceptions</h3>
        <p className="mt-2 text-sm text-slate-400">
          Forced open, held open and access denied events detected in the
          import.
        </p>

        {analysis.recentExceptions.length === 0 ? (
          <p className="mt-6 text-sm text-slate-400">
            No compliance exceptions detected in this import.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Event time</th>
                  <th className="px-4 py-3 font-medium">Event type</th>
                  <th className="px-4 py-3 font-medium">Door</th>
                  <th className="px-4 py-3 font-medium">Access result</th>
                </tr>
              </thead>
              <tbody>
                {analysis.recentExceptions.map((item, index) => (
                  <tr key={index} className="border-b border-slate-800">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                      {item.time}
                    </td>
                    <td className="px-4 py-3 text-white">{item.type}</td>
                    <td className="px-4 py-3 text-slate-300">{item.door}</td>
                    <td className="px-4 py-3 text-slate-300">{item.result}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </ReportPageShell>
  );
}
