"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_ANALYTICS_CONFIG,
  DEFAULT_IMPORT_DATA_RETENTION_DAYS,
  getAnalyticsConfig,
  saveAnalyticsConfig,
} from "@/lib/analytics/config";
import {
  MAX_IMPORT_DATA_RETENTION_DAYS,
  MIN_IMPORT_DATA_RETENTION_DAYS,
} from "@/lib/analytics/import-data-retention";
import { formatDurationReadable } from "@/lib/reports/held-open-detection";
import { refreshImportAnalysis } from "@/lib/client/imports-api";
import { dispatchImportsRefreshed } from "@/lib/imports/imports-refreshed";
import { InboundEmailSettingsPanel } from "@/components/settings/inbound-email-settings-panel";

function buildRefreshMessage(result: {
  refreshed: number;
  skipped: number;
}): string {
  if (result.refreshed === 0) {
    if (result.skipped > 0) {
      return "Settings saved. No imports could be recalculated with the new threshold.";
    }

    return "Settings saved. No mapped imports were available to recalculate.";
  }

  const parts = [
    `Recalculated ${result.refreshed} import${result.refreshed === 1 ? "" : "s"} with the new threshold.`,
  ];

  if (result.skipped > 0) {
    parts.push(
      `${result.skipped} import${result.skipped === 1 ? "" : "s"} could not be replayed.`,
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
  const [retentionDays, setRetentionDays] = useState(
    DEFAULT_IMPORT_DATA_RETENTION_DAYS,
  );
  const [saved, setSaved] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    const loaded = getAnalyticsConfig();
    const parts = splitThresholdSeconds(loaded.heldOpenThresholdSeconds);
    setThresholdMinutes(parts.minutes);
    setThresholdSeconds(parts.seconds);
    setRetentionDays(loaded.importDataRetentionDays);
  }, []);

  const totalThresholdSeconds = useMemo(
    () => combineThresholdSeconds(thresholdMinutes, thresholdSeconds),
    [thresholdMinutes, thresholdSeconds],
  );

  function updateThreshold(minutes: number, seconds: number) {
    setThresholdMinutes(Math.max(0, minutes));
    setThresholdSeconds(Math.max(0, Math.min(59, seconds)));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    const previous = getAnalyticsConfig();
    const nextConfig = {
      heldOpenThresholdSeconds: totalThresholdSeconds,
      importDataRetentionDays: retentionDays,
    };
    saveAnalyticsConfig(nextConfig);

    try {
      if (
        previous.heldOpenThresholdSeconds !== nextConfig.heldOpenThresholdSeconds
      ) {
        const refreshResult = await refreshImportAnalysis(nextConfig);
        setSaved(true);
        setRefreshMessage(buildRefreshMessage(refreshResult));
      } else {
        dispatchImportsRefreshed();
        setSaved(true);
        setRefreshMessage(
          "Settings saved. Dashboards now use the updated import data retention window.",
        );
      }
    } catch {
      setSaved(true);
      setRefreshMessage("Settings saved, but import recalculation failed.");
    }

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
          Configure held-open thresholds and how much historical import data is
          included in dashboards, trends, and reports.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-8 rounded-2xl border border-slate-800 bg-slate-900 p-6"
      >
        <section>
          <p className="text-sm font-medium text-white">Import data retention</p>
          <p className="mt-1 text-sm text-slate-400">
            Only events and incidents from the past{" "}
            {retentionDays} day{retentionDays === 1 ? "" : "s"} are included in
            analytics. Older import activity is kept in storage but excluded from
            dashboards, door profiles, trends, heat maps, and PDF exports.
          </p>

          <label className="mt-4 block max-w-xs">
            <span className="text-sm text-slate-300">Retention period (days)</span>
            <input
              id="import-data-retention-days"
              type="number"
              min={MIN_IMPORT_DATA_RETENTION_DAYS}
              max={MAX_IMPORT_DATA_RETENTION_DAYS}
              value={retentionDays}
              onChange={(event) =>
                setRetentionDays(
                  Math.min(
                    MAX_IMPORT_DATA_RETENTION_DAYS,
                    Math.max(
                      MIN_IMPORT_DATA_RETENTION_DAYS,
                      Number(event.target.value) || MIN_IMPORT_DATA_RETENTION_DAYS,
                    ),
                  ),
                )
              }
              className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </label>
        </section>

        <section>
        <p className="text-sm font-medium text-white">Held-open threshold</p>
        <p className="mt-1 text-sm text-slate-400">
          Only time exceeding this threshold counts toward time beyond threshold.
          Incidents are detected from explicit held-open alarms in your export,
          or when a door opened event is followed by a door closed event beyond
          this threshold.
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
        </section>

        <div className="flex items-center gap-3">
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

      <InboundEmailSettingsPanel />
    </div>
  );
}
