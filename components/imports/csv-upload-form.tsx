"use client";

import Link from "next/link";
import Papa from "papaparse";
import { useState } from "react";
import { saveImport, saveImportData, StorageError } from "@/lib/imports/storage";
import {
  fixHeaderlessCsvParse,
  looksLikeHeaderlessExport,
} from "@/lib/imports/resolve-mapping";
import type { ImportRecord } from "@/lib/imports/types";
import { IMPORT_STATUS_LABELS, PREVIEW_ROW_LIMIT } from "@/lib/imports/types";

type CsvRow = Record<string, string>;

export function CsvUploadForm() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [importRecord, setImportRecord] = useState<ImportRecord | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportRecord(null);
    setStorageError(null);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        let parsedHeaders = results.meta.fields ?? [];
        let parsedRows = results.data;

        if (looksLikeHeaderlessExport(parsedHeaders)) {
          const fixed = fixHeaderlessCsvParse(parsedHeaders, parsedRows);
          parsedHeaders = fixed.headers;
          parsedRows = fixed.rows;
        }

        setRows(parsedRows);
        setHeaders(parsedHeaders);

        const record: ImportRecord = {
          id: crypto.randomUUID(),
          fileName: file.name,
          rowCount: parsedRows.length,
          columnCount: parsedHeaders.length,
          headers: parsedHeaders,
          status: "ready_for_mapping",
          uploadedAt: new Date().toISOString(),
          previewRows: [],
        };

        try {
          saveImport(record);
          saveImportData(record.id, parsedRows);
          setImportRecord({
            ...record,
            previewRows: parsedRows.slice(0, PREVIEW_ROW_LIMIT),
          });
        } catch (error) {
          setRows([]);
          setHeaders([]);
          setImportRecord(null);

          if (error instanceof StorageError) {
            setStorageError(error.message);
          } else {
            setStorageError("Failed to save import. Please try again.");
          }
        }
      },
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <Link
          href="/imports"
          className="text-sm text-cyan-400 hover:text-cyan-300"
        >
          ← Back to imports
        </Link>

        <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-cyan-400">
          CSV Upload
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">
          Upload Genetec Fire Exit Export
        </h2>
        <p className="mt-4 max-w-3xl text-slate-300">
          Upload a Genetec fire exit export so Exit Compliance Pro can process
          held-open events, forced-open incidents and door health data.
        </p>
      </div>

      <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10">
        <label
          htmlFor="csv-upload"
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950 px-6 py-16 text-center hover:border-cyan-500"
        >
          <span className="text-lg font-semibold">Select CSV file</span>
          <span className="mt-2 text-sm text-slate-400">
            Genetec .csv export only
          </span>

          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>

        {fileName && !importRecord && !storageError && (
          <p className="mt-4 text-sm text-slate-300">
            Processing: <span className="font-semibold">{fileName}</span>
          </p>
        )}

        {storageError && (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {storageError}
          </p>
        )}
      </section>

      {importRecord && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-2xl font-semibold">Import summary</h3>
          <p className="mt-2 text-sm text-slate-400">
            Your file has been parsed and is ready for the next step.
          </p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryItem label="File name" value={importRecord.fileName} />
            <SummaryItem
              label="Total rows"
              value={importRecord.rowCount.toString()}
            />
            <SummaryItem
              label="Total columns"
              value={importRecord.columnCount.toString()}
            />
            <SummaryItem
              label="Import status"
              value={IMPORT_STATUS_LABELS[importRecord.status]}
              highlight
            />
          </dl>

          <div className="mt-6">
            <p className="text-sm font-medium text-slate-300">
              Headers detected
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {importRecord.headers.map((header) => (
                <span
                  key={header}
                  className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-300 ring-1 ring-slate-700"
                >
                  {header}
                </span>
              ))}
            </div>
          </div>

          <Link
            href="/imports/mapping"
            className="mt-8 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Continue to Field Mapping
          </Link>
        </section>
      )}

      {rows.length > 0 && importRecord && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-2xl font-semibold">CSV Preview</h3>
          <p className="mt-2 text-sm text-slate-400">
            Showing {Math.min(rows.length, 10)} of {importRecord.rowCount}{" "}
            rows. Full-file analysis is stored at upload; only a preview subset
            is kept in browser storage for display.
          </p>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-700 text-slate-300">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="whitespace-nowrap px-4 py-3">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((row, index) => (
                  <tr key={index} className="border-b border-slate-800">
                    {headers.map((header) => (
                      <td
                        key={header}
                        className="whitespace-nowrap px-4 py-3 text-slate-300"
                      >
                        {row[header]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryItem({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <dt className="text-sm text-slate-400">{label}</dt>
      <dd
        className={`mt-1 text-lg font-semibold ${highlight ? "text-cyan-400" : "text-white"}`}
      >
        {value}
      </dd>
    </div>
  );
}
