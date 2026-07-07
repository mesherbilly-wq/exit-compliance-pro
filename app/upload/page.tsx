export default function UploadPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-5xl px-6 py-10">
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
            />
          </label>

          <button className="mt-6 rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
            Process CSV
          </button>
        </section>
      </div>
    </main>
  );
}
