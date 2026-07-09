"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_ANALYTICS_CONFIG,
  getAnalyticsConfig,
  saveAnalyticsConfig,
} from "@/lib/analytics/config";
import type { FireExitAnalyticsConfig } from "@/lib/analytics/types";

export function SettingsContent() {
  const [config, setConfig] = useState<FireExitAnalyticsConfig>(
    DEFAULT_ANALYTICS_CONFIG,
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setConfig(getAnalyticsConfig());
  }, []);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    saveAnalyticsConfig(config);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-cyan-400">
          Settings
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight">
          Fire Exit Intelligence Settings
        </h2>
        <p className="mt-4 text-slate-300">
          Configure held-open thresholds used by the analytics engine across all
          fire exit reports.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <label htmlFor="held-open-threshold" className="text-sm font-medium text-white">
          Held-open threshold (seconds)
        </label>
        <p className="mt-1 text-sm text-slate-400">
          Only time exceeding this threshold counts toward exposure. Explicit
          held-open alarms are always treated as violations.
        </p>
        <input
          id="held-open-threshold"
          type="number"
          min={1}
          value={config.heldOpenThresholdSeconds}
          onChange={(event) =>
            setConfig({
              heldOpenThresholdSeconds: Number(event.target.value),
            })
          }
          className="mt-4 w-full max-w-xs rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
        />

        <div className="mt-6 flex items-center gap-3">
          <button
            type="submit"
            className="rounded-lg bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Save settings
          </button>
          {saved && (
            <span className="text-sm text-emerald-400">Settings saved.</span>
          )}
        </div>
      </form>
    </div>
  );
}
