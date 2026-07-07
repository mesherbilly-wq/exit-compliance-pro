"use client";

import Papa from "papaparse";
import { useState } from "react";

type CsvRow = Record<string, string>;

export default function UploadPage() {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);

    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setRows(results.data);
        setHeaders(results.meta.fields ?? []);
      },
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <a href="/" className="text-sm text-cyan-400 hover:text-cyan-300">
          ← Back to dashboard
        </a>

        <header className="mt-8 mb-10">
          <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
            CSV Upload
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Upload Genetec CSV Export
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300">
            Upload a Genetec access-control export so Exit Compliance Pro can
            process door activity, attendance data and exception events.
          </p>
        </header>

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

          {fileName && (
            <p className="mt-4 text-sm text-slate-300">
              Uploaded: <span className="font-semibold">{fileName}</span>
            </p>
          )}
        </section>

        {rows.length > 0 && (
          <section className="mt-10 rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-2xl font-semibold">CSV Preview</h2>
            <p className="mt-2 text-sm text-slate-400">
              Showing {Math.min(rows.length, 10)} of {rows.length} rows.
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
    </main>
  );
}
