"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ANALYTICS_CONFIG,
  getAnalyticsConfig,
  saveAnalyticsConfig,
} from "@/lib/analytics/config";
import { formatDurationReadable } from "@/lib/reports/held-open-detection";
import { refreshAllImportAnalysisSnapshots } from "@/lib/imports/storage";
import { dispatchImportsRefreshed } from "@/lib/imports/imports-refreshed";

function buildRefreshMessage(result: {
  refreshed: number;
  skipped: number;
  previewFallback: number;
}): string {
  if (result.refreshed === 0) {
    if (result.skipped > 0) {
      return "Settings saved. Re-upload your CSV to recalculate imports with the new threshold.";
    }

    return "Settings saved. No mapped imports were available to recalculate.";
  }

  const parts = [
    `Recalculated ${result.refreshed} import${result.refreshed === 1 ? "" : "s"} with the new threshold.`,
  ];

  if (result.skipped > 0) {
    parts.push(
      `${result.skipped} import${result.skipped === 1 ? "" : "s"} could not be replayed — re-upload the CSV to apply the threshold to the full dataset.`,
    );
  }

  if (result.previewFallback > 0) {
    parts.push(
      `${result.previewFallback} import${result.previewFallback === 1 ? "" : "s"} used preview data only.`,
    );
  }

  return parts.join(" ");
}

function splitThresholdSeconds(totalSeconds: number): {
  minutes: number;
  seconds: number;
} {
  const safeTotal = Math.max(1, Math.round(totalSeconds));
  return {
    minutes: Math.floor(safeTotal / 60),
    seconds: safeTotal % 60,
  };
}

function combineThresholdSeconds(minutes: number, seconds: number): number {
  const safeMinutes = Math.max(0, Math.floor(minutes) || 0);
  const safeSeconds = Math.max(0, Math.min(59, Math.floor(seconds) || 0));
  return Math.max(1, safeMinutes * 60 + safeSeconds);
}

export function SettingsContent() {
  const [thresholdMinutes, setThresholdMinutes] = useState(0);
  const [thresholdSeconds, setThresholdSeconds] = useState(
    DEFAULT_ANALYTICS_CONFIG.heldOpenThresholdSeconds,
  );
  const [saved, setSaved] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    const loaded = getAnalyticsConfig();
    const parts = splitThresholdSeconds(loaded.heldOpenThresholdSeconds);
    setThresholdMinutes(parts.minutes);
    setThresholdSeconds(parts.seconds);
  }, []);

  const totalThresholdSeconds = useMemo(
    () => combineThresholdSeconds(thresholdMinutes, thresholdSeconds),
    [thresholdMinutes, thresholdSeconds],
  );

  function updateThreshold(minutes: number, seconds: number) {
    setThresholdMinutes(Math.max(0, minutes));
    setThresholdSeconds(Math.max(0, Math.min(59, seconds)));
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    saveAnalyticsConfig({
      heldOpenThresholdSeconds: totalThresholdSeconds,
    });
    const refreshResult = refreshAllImportAnalysisSnapshots();
    dispatchImportsRefreshed();
    setSaved(true);
    setRefreshMessage(buildRefreshMessage(refreshResult));
    window.setTimeout(() => {
      setSaved(false);
      setRefreshMessage(null);
    }, 4000);
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
        <p className="text-sm font-medium text-white">Held-open threshold</p>
        <p className="mt-1 text-sm text-slate-400">
          Only time exceeding this threshold counts toward time beyond threshold. Explicit
          held-open alarms are always treated as violations.
        </p>

        <div className="mt-4 grid max-w-md grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-slate-300">Minutes</span>
            <input
              id="held-open-threshold-minutes"
              type="number"
              min={0}
              value={thresholdMinutes}
              onChange={(event) =>
                updateThreshold(Number(event.target.value), thresholdSeconds)
              }
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Seconds</span>
            <input
              id="held-open-threshold-seconds"
              type="number"
              min={0}
              max={59}
              value={thresholdSeconds}
              onChange={(event) =>
                updateThreshold(thresholdMinutes, Number(event.target.value))
              }
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          Total threshold:{" "}
          <span className="font-medium text-slate-300">
            {formatDurationReadable(totalThresholdSeconds)}
          </span>
        </p>

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
        {refreshMessage && (
          <p className="mt-3 text-sm text-cyan-300">{refreshMessage}</p>
        )}
      </form>
    </div>
  );
}
