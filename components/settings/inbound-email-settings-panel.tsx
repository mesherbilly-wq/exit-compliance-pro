"use client";

import { useCallback, useEffect, useState } from "react";

type InboundEmailStatusResponse = {
  configured: boolean;
  inboundEmailAddress: string | null;
  webhookStatus: string;
  lastReceived: {
    from_address: string;
    subject: string | null;
    received_at: string | null;
    status: string;
  } | null;
  lastSuccessfulImport: {
    file_name: string;
    created_at: string;
    row_count: number;
  } | null;
  lastFailure: {
    from_address: string;
    subject: string | null;
    failure_reason: string | null;
    created_at: string;
  } | null;
};

export function InboundEmailSettingsPanel() {
  const [status, setStatus] = useState<InboundEmailStatusResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch("/api/inbound-email/status");
    if (response.ok) {
      setStatus((await response.json()) as InboundEmailStatusResponse);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleCopy() {
    if (!status?.inboundEmailAddress) {
      return;
    }

    await navigator.clipboard.writeText(status.inboundEmailAddress);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <p className="text-sm font-medium text-white">Inbound email</p>
      <p className="mt-1 text-sm text-slate-400">
        Email Genetec CSV exports to the dedicated inbound address for automatic
        processing.
      </p>

      <dl className="mt-6 space-y-4">
        <div>
          <dt className="text-sm text-slate-400">Inbound email address</dt>
          <dd className="mt-1 flex flex-wrap items-center gap-3">
            <span className="font-mono text-sm text-white">
              {status?.inboundEmailAddress ?? "Not configured"}
            </span>
            {status?.inboundEmailAddress && (
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500"
              >
                {copied ? "Copied" : "Copy address"}
              </button>
            )}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">Webhook status</dt>
          <dd className="mt-1 text-sm text-white">
            {status?.webhookStatus ?? "Loading..."}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">Last received email</dt>
          <dd className="mt-1 text-sm text-slate-300">
            {status?.lastReceived
              ? `${status.lastReceived.from_address} · ${status.lastReceived.subject ?? "No subject"} · ${
                  status.lastReceived.received_at
                    ? new Date(status.lastReceived.received_at).toLocaleString()
                    : "Unknown time"
                }`
              : "No inbound emails received yet."}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">Last successful import</dt>
          <dd className="mt-1 text-sm text-slate-300">
            {status?.lastSuccessfulImport
              ? `${status.lastSuccessfulImport.file_name} · ${status.lastSuccessfulImport.row_count.toLocaleString()} rows · ${new Date(status.lastSuccessfulImport.created_at).toLocaleString()}`
              : "No successful inbound imports yet."}
          </dd>
        </div>

        <div>
          <dt className="text-sm text-slate-400">Last failure</dt>
          <dd className="mt-1 text-sm text-slate-300">
            {status?.lastFailure
              ? `${status.lastFailure.from_address} · ${status.lastFailure.failure_reason ?? "Unknown failure"} · ${new Date(status.lastFailure.created_at).toLocaleString()}`
              : "No inbound failures recorded."}
          </dd>
        </div>
      </dl>
    </section>
  );
}
