"use client";

import { useCallback, useEffect, useState } from "react";
import type { ServerImportListItem } from "@/lib/server/types/inbound-email";

const SERVER_STATUS_STYLES: Record<string, string> = {
  processing: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30",
  processed: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
  rejected: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
  failed: "bg-red-500/10 text-red-400 ring-red-500/30",
  ready_for_mapping: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/30",
  mapped: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
};

function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function InboundImportsTable() {
  const [configured, setConfigured] = useState(false);
  const [inboundEmailAddress, setInboundEmailAddress] = useState<string | null>(
    null,
  );
  const [imports, setImports] = useState<ServerImportListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const [importsResponse, statusResponse] = await Promise.all([
      fetch("/api/imports/inbound"),
      fetch("/api/inbound-email/status"),
    ]);

    if (importsResponse.ok) {
      const importsPayload = (await importsResponse.json()) as {
        configured: boolean;
        imports: ServerImportListItem[];
      };
      setConfigured(importsPayload.configured);
      setImports(importsPayload.imports ?? []);
    }

    if (statusResponse.ok) {
      const statusPayload = (await statusResponse.json()) as {
        inboundEmailAddress?: string | null;
      };
      setInboundEmailAddress(statusPayload.inboundEmailAddress ?? null);
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!loaded) {
    return <p className="text-sm text-slate-400">Loading inbound imports...</p>;
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-xl font-semibold">Inbound email imports</h3>
        <p className="mt-1 text-sm text-slate-400">
          Genetec CSV reports received automatically via inbound email and processed
          on the server.
        </p>
      </div>

      {inboundEmailAddress ? (
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <p className="text-sm font-medium text-cyan-300">Inbound report address</p>
          <p className="mt-2 font-mono text-sm text-white">{inboundEmailAddress}</p>
          <p className="mt-2 text-sm text-slate-400">
            Email a Genetec fire exit CSV export to this address to create a processed
            import automatically.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-6 text-sm text-slate-400">
          Configure <code className="text-slate-300">INBOUND_REPORT_EMAIL</code> and
          the Resend/Supabase environment variables to enable inbound email imports.
        </div>
      )}

      {!configured ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-400">
          Server-side inbound email storage is not configured yet.
        </div>
      ) : imports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-400">
          No inbound email imports have been processed yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-700 text-slate-300">
              <tr>
                <th className="px-4 py-3 font-medium">File name</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Sender</th>
                <th className="px-4 py-3 font-medium">Email subject</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Rows processed</th>
                <th className="px-4 py-3 font-medium">Processing result</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((item) => (
                <tr key={item.id} className="border-b border-slate-800 last:border-0">
                  <td className="px-4 py-3 font-medium text-white">{item.fileName}</td>
                  <td className="px-4 py-3 text-slate-300">Inbound email</td>
                  <td className="px-4 py-3 text-slate-300">{item.sender ?? "N/A"}</td>
                  <td className="px-4 py-3 text-slate-300">
                    {item.emailSubject ?? "N/A"}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {item.receivedAt
                      ? new Date(item.receivedAt).toLocaleString()
                      : "N/A"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
                        SERVER_STATUS_STYLES[item.status] ??
                        "bg-slate-500/10 text-slate-300 ring-slate-500/30"
                      }`}
                    >
                      {formatStatusLabel(item.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {item.rowCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    {item.processingResult ?? "N/A"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
