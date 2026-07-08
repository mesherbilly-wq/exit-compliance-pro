"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  analyzeDoorHealth,
  canRunDoorHealthAnalysis,
  sortDoors,
  type DoorHealthAnalysis,
  type DoorSortKey,
} from "@/lib/reports/analyze-door-health";
import type { DoorHealthStatus } from "@/lib/reports/held-open-detection";
import {
  getFieldMapping,
  getLatestImport,
  getLatestImportData,
} from "@/lib/imports/storage";
import type { FieldMapping, ImportRecord } from "@/lib/imports/types";

const STATUS_STYLES: Record<DoorHealthStatus, string> = {
  Excellent: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  Good: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30",
  "Needs Attention": "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  Critical: "bg-red-500/10 text-red-400 ring-red-500/30",
};

export function DoorHealthContent() {
  const [importRecord, setImportRecord] = useState<ImportRecord | null>(null);
  const [mapping, setMapping] = useState<FieldMapping | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<DoorSortKey>("score");

  useEffect(() => {
    const latest = getLatestImport();
    setImportRecord(latest);
    setMapping(latest ? getFieldMapping(latest.id) : null);
    setLoaded(true);
  }, []);

  const rows = useMemo(() => getLatestImportData(), [loaded, importRecord]);

  const analysis = useMemo<DoorHealthAnalysis | null>(() => {
    if (!importRecord || !mapping || !canRunDoorHealthAnalysis(rows, mapping)) {
      return null;
    }

    return analyzeDoorHealth(
      rows,
      mapping,
      importRecord.headers,
      importRecord.fileName,
    );
  }, [importRecord, mapping, rows]);

  const filteredDoors = useMemo(() => {
    if (!analysis) return [];

    const query = search.trim().toLowerCase();
    const doors = query
      ? analysis.doors.filter((door) => door.door.toLowerCase().includes(query))
      : analysis.doors;

    return sortDoors(doors, sortBy);
  }, [analysis, search, sortBy]);

  if (!loaded) {
    return <p className="text-sm text-slate-400">Loading door health...</p>;
  }

  if (!importRecord) {
    return (
      <DoorHealthEmptyState
        title="No fire exit data imported yet"
        message="Upload a Genetec CSV to start analysing fire exit door health."
      >
        <Link
          href="/imports/upload"
          className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Upload CSV
        </Link>
      </DoorHealthEmptyState>
    );
  }

  if (!analysis) {
    return (
      <DoorHealthEmptyState
        title="Field mapping required"
        message="Complete field mapping for your latest import to analyse fire exit door health."
      >
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/imports/mapping"
            className="rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Field mapping
          </Link>
          <Link
            href="/imports/upload"
            className="rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 hover:border-cyan-500"
          >
            Upload new CSV
          </Link>
        </div>
      </DoorHealthEmptyState>
    );
  }

  const summaryCards = [
    { label: "Total Doors", value: analysis.totalDoors.toLocaleString(), accent: "text-white" },
    {
      label: "Excellent Doors",
      value: analysis.excellentDoors.toLocaleString(),
      accent: "text-emerald-400",
    },
    {
      label: "Doors Needing Attention",
      value: analysis.doorsNeedingAttention.toLocaleString(),
      accent: "text-amber-400",
    },
    {
      label: "Critical Doors",
      value: analysis.criticalDoors.toLocaleString(),
      accent: "text-red-400",
    },
    {
      label: "Worst Door",
      value: analysis.worstDoor,
      accent: "text-red-400",
      small: true,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Doors
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">
          Fire Exit Door Health
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Door-level held-open analysis for{" "}
          <span className="font-medium text-white">
            {analysis.sourceFileName}
          </span>
          . Focused on fire exit life safety performance only.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p
              className={`mt-2 font-bold ${card.accent} ${
                card.small ? "text-lg" : "text-3xl"
              }`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-md">
          <label htmlFor="door-search" className="text-sm font-medium text-slate-300">
            Search doors
          </label>
          <input
            id="door-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by door name..."
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>

        <div className="w-full lg:max-w-xs">
          <label htmlFor="door-sort" className="text-sm font-medium text-slate-300">
            Sort by
          </label>
          <select
            id="door-sort"
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as DoorSortKey)}
            className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
          >
            <option value="score">Compliance score (lowest first)</option>
            <option value="heldOpen">Held-open events (highest first)</option>
            <option value="longestDuration">Longest duration (highest first)</option>
          </select>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-xl font-semibold">Door health table</h3>
          <p className="mt-1 text-sm text-slate-400">
            Showing {filteredDoors.length} of {analysis.doors.length} doors.
          </p>
        </div>

        {filteredDoors.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center">
            <p className="text-sm text-slate-400">
              No doors match your search filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Door name</th>
                  <th className="px-4 py-3 font-medium">Total events</th>
                  <th className="px-4 py-3 font-medium">Held-open events</th>
                  <th className="px-4 py-3 font-medium">Average open duration</th>
                  <th className="px-4 py-3 font-medium">Longest open duration</th>
                  <th className="px-4 py-3 font-medium">Last event time</th>
                  <th className="px-4 py-3 font-medium">Compliance score</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredDoors.map((door) => (
                  <tr key={door.door} className="border-b border-slate-800">
                    <td className="px-4 py-3 font-medium text-white">{door.door}</td>
                    <td className="px-4 py-3 text-slate-300">{door.totalEvents}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {door.heldOpenEvents}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {door.averageDurationLabel}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {door.longestDurationLabel}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                      {door.lastEventTime}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {door.complianceScore}%
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${STATUS_STYLES[door.status]}`}
                      >
                        {door.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DoorHealthEmptyState({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
        Doors
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight">
        Fire Exit Door Health
      </h2>
      <p className="mt-4 max-w-3xl text-slate-300">
        Monitor fire exit door health, held-open events and compliance scoring
        across your estate.
      </p>

      <section className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="mt-3 text-sm text-slate-400">{message}</p>
        {children}
      </section>
    </div>
  );
}
