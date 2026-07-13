"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useLatestImport } from "@/lib/client/latest-import";
import {
  updateImportMappingApi,
} from "@/lib/client/imports-api";
import { resolveFieldMapping } from "@/lib/imports/resolve-mapping";
import {
  areRequiredFieldsMapped,
  getMappingCompleteness,
} from "@/lib/imports/mapping-utils";
import {
  GENETEC_FIELDS,
  isPreviewOnlyAnalysis,
  type FieldMapping,
} from "@/lib/imports/types";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";

export function FieldMappingContent() {
  const { loadedImport, loaded, reload } = useLatestImport();
  const importRecord = loadedImport?.record ?? null;
  const [mapping, setMapping] = useState<FieldMapping | null>(null);
  const [saving, setSaving] = useState(false);

  useImportsRefreshed(reload);

  useEffect(() => {
    if (!importRecord) {
      setMapping(null);
      return;
    }

    const initial =
      importRecord.analysisSnapshot?.mapping ??
      resolveFieldMapping(importRecord.headers, [], null);

    setMapping(initial);
  }, [importRecord]);

  const completeness = useMemo(
    () => (mapping ? getMappingCompleteness(mapping) : 0),
    [mapping],
  );

  const requiredMapped = useMemo(
    () => (mapping ? areRequiredFieldsMapped(mapping) : false),
    [mapping],
  );

  async function handleMappingChange(fieldKey: keyof FieldMapping, value: string) {
    if (!importRecord || !mapping) return;

    const updated = { ...mapping, [fieldKey]: value };
    setMapping(updated);
    setSaving(true);

    try {
      await updateImportMappingApi(importRecord.id, updated);
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Failed to save field mapping.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-5xl">
        <p className="text-sm text-slate-400">Loading import...</p>
      </div>
    );
  }

  if (!importRecord || !mapping) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link
          href="/imports"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to imports
        </Link>

        <div className="mt-8 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
          <h2 className="text-xl font-semibold">No import found</h2>
          <p className="mt-3 text-sm text-slate-400">
            Upload a Genetec CSV file before mapping fields.
          </p>
          <Link
            href="/imports/upload"
            className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Upload CSV
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <Link
          href="/imports"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to imports
        </Link>

        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Field Mapping
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">
          Map Fire Exit CSV Fields
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Match detected CSV columns to fire exit fields for{" "}
          <span className="font-semibold text-white">
            {importRecord.fileName}
          </span>
          . Required fields must be mapped before running compliance analysis.
        </p>
      </div>

      {isPreviewOnlyAnalysis(importRecord) && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Analysis snapshot is incomplete for this import.
        </p>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold">Mapping completeness</h3>
            <p className="mt-1 text-sm text-slate-400">
              {completeness}% of fields mapped
              {saving ? " · Saving..." : ""}
            </p>
          </div>
          <p className="text-3xl font-bold text-cyan-400">{completeness}%</p>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-cyan-500 transition-all duration-300"
            style={{ width: `${completeness}%` }}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold">Detected CSV headers</h3>
        <p className="mt-2 text-sm text-slate-400">
          {importRecord.headers.length} columns detected in the latest import.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {importRecord.headers.map((header) => (
            <span
              key={header}
              className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700"
            >
              {header}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-lg font-semibold">Field mappings</h3>
        <p className="mt-2 text-sm text-slate-400">
          Select the CSV column that corresponds to each Genetec field.
        </p>

        <div className="mt-6 space-y-4">
          {GENETEC_FIELDS.map((field) => (
            <div
              key={field.key}
              className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4 sm:grid-cols-[220px_1fr]"
            >
              <label
                htmlFor={field.key}
                className="flex items-center text-sm font-medium text-white"
              >
                {field.label}
                {field.required && (
                  <span className="ml-2 text-xs text-cyan-400">Required</span>
                )}
              </label>

              <select
                id={field.key}
                value={mapping[field.key]}
                onChange={(event) =>
                  handleMappingChange(field.key, event.target.value)
                }
                disabled={saving}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              >
                <option value="">— Select CSV column —</option>
                {importRecord.headers.map((header) => (
                  <option key={header} value={header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          {requiredMapped
            ? "Required fields mapped. Compliance analysis is ready."
            : "Map Event time, Event type, and Door name to continue."}
        </p>

        {requiredMapped ? (
          <Link
            href="/compliance"
            className="rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            View Compliance Analysis
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-lg bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-500"
          >
            View Compliance Analysis
          </button>
        )}
      </div>
    </div>
  );
}
