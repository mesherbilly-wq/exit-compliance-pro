"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SectionPageShell } from "@/components/ui/section-page-shell";
import {
  analyzeExitCompliance,
  canRunExitComplianceAnalysis,
} from "@/lib/reports/analyze-exit-compliance";
import type { ExitComplianceAnalysis } from "@/lib/reports/analyze-exit-compliance";
import {
  getFieldMapping,
  getLatestImport,
  getLatestImportData,
} from "@/lib/imports/storage";
import type { FieldMapping, ImportRecord } from "@/lib/imports/types";

export function ComplianceAnalysisContent() {
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
      <SectionPageShell
        eyebrow="Compliance"
        title="Fire Exit Compliance"
        description="Loading compliance analysis..."
      >
        <p className="text-sm text-slate-400">Loading...</p>
      </SectionPageShell>
    );
  }

  if (!analysis || !importRecord) {
    return (
      <SectionPageShell
        eyebrow="Compliance"
        title="Fire Exit Compliance"
        description="Analyse held-open exit events, forced-open incidents, door health and compliance scoring from imported Genetec fire exit data."
      >
        <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
          <h3 className="text-lg font-semibold">Import required</h3>
          <p className="mt-3 text-sm text-slate-400">
            Upload a Genetec fire exit CSV and complete field mapping to run
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
      </SectionPageShell>
    );
  }

  const statCards = [
    { label: "Total exit events", value: analysis.totalEvents, accent: "text-white" },
    { label: "Fire exit doors", value: analysis.uniqueDoors, accent: "text-cyan-400" },
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
      label: "Life safety exceptions",
      value: analysis.lifeSafetyExceptions,
      accent: "text-orange-400",
    },
  ];

  return (
    <SectionPageShell
      eyebrow="Compliance"
      title="Fire Exit Compliance"
      description="Analyse held-open exit events, forced-open incidents, repeat issue doors and compliance scoring from imported Genetec data."
    >
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
        <h3 className="text-lg font-semibold">Repeat issue exit doors</h3>
        <p className="mt-2 text-sm text-slate-400">
          Exit doors with the highest volume of fire exit and life safety
          events.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-700 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">Exit door</th>
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
        <h3 className="text-lg font-semibold">Recent life safety exceptions</h3>
        <p className="mt-2 text-sm text-slate-400">
          Held-open and forced-open fire exit events requiring review.
        </p>

        {analysis.recentExceptions.length === 0 ? (
          <p className="mt-6 text-sm text-slate-400">
            No life safety exceptions detected in this import.
          </p>
        ) : (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Event time</th>
                  <th className="px-4 py-3 font-medium">Event type</th>
                  <th className="px-4 py-3 font-medium">Exit door</th>
                  <th className="px-4 py-3 font-medium">Status</th>
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
    </SectionPageShell>
  );
}
