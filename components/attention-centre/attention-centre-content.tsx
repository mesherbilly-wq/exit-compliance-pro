"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { RiskRating } from "@/lib/analytics/door-intelligence-view";
import type {
  AttentionCentreDashboard,
  AttentionCentreFilters,
} from "@/lib/analytics/attention-centre/types";
import { fetchAttentionCentreDashboard } from "@/lib/client/attention-centre-api";
import { useImportsRefreshed } from "@/lib/imports/imports-refreshed";
import { DoorLink } from "@/components/doors/door-link";
import { SectionPageShell } from "@/components/ui/section-page-shell";
import { AttentionCentreFiltersBar } from "@/components/attention-centre/attention-centre-filters";

const RISK_STYLES: Record<RiskRating, string> = {
  Low: "text-emerald-400",
  Medium: "text-cyan-400",
  High: "text-amber-400",
  Critical: "text-red-400",
};

const TIER_STYLES = {
  critical: "border-red-500/30 bg-red-500/10",
  high: "border-orange-500/30 bg-orange-500/10",
  medium: "border-amber-500/30 bg-amber-500/10",
  low: "border-cyan-500/30 bg-cyan-500/10",
};

function SectionCard({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{description}</p>
        </div>
        <span className="rounded-full bg-slate-950 px-3 py-1 text-sm font-semibold text-slate-300 ring-1 ring-slate-700">
          {count}
        </span>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function AttentionCentreContent() {
  const [dashboard, setDashboard] = useState<AttentionCentreDashboard | null>(
    null,
  );
  const [filters, setFilters] = useState<AttentionCentreFilters | null>(null);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(
    async (nextFilters?: Partial<AttentionCentreFilters>) => {
      setLoading(true);
      setError(null);

      try {
        const payload = await fetchAttentionCentreDashboard(nextFilters);

        setConfigured(payload.configured);
        setDashboard(payload.dashboard);

        if (payload.dashboard) {
          setFilters(payload.dashboard.filters);
        }
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Failed to load Attention Centre.",
        );
        setDashboard(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useImportsRefreshed(() => loadDashboard());

  function handleFiltersChange(nextFilters: AttentionCentreFilters) {
    setFilters(nextFilters);
    loadDashboard(nextFilters);
  }

  if (!configured) {
    return (
      <SectionPageShell
        eyebrow="Attention Centre"
        title="What do I need to act on today?"
        description="Operational dashboard showing only fire exit items that require attention, investigation, or recognition."
      >
        <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-400">
            Supabase is not configured. Connect your database to load attention items.
          </p>
        </section>
      </SectionPageShell>
    );
  }

  if (loading && !dashboard) {
    return (
      <SectionPageShell
        eyebrow="Attention Centre"
        title="What do I need to act on today?"
        description="Operational dashboard showing only fire exit items that require attention, investigation, or recognition."
      >
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-400">Loading attention items…</p>
        </section>
      </SectionPageShell>
    );
  }

  if (error && !dashboard) {
    return (
      <SectionPageShell
        eyebrow="Attention Centre"
        title="What do I need to act on today?"
        description="Operational dashboard showing only fire exit items that require attention, investigation, or recognition."
      >
        <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6">
          <p className="text-sm text-red-200">{error}</p>
        </section>
      </SectionPageShell>
    );
  }

  if (!dashboard?.hasProcessedImports) {
    return (
      <SectionPageShell
        eyebrow="Attention Centre"
        title="What do I need to act on today?"
        description="Operational dashboard showing only fire exit items that require attention, investigation, or recognition."
      >
        <section className="rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-10 text-center">
          <p className="text-sm text-slate-400">
            No processed imports yet. Upload import data to populate the Attention Centre.
          </p>
          <Link
            href="/imports/upload"
            className="mt-6 inline-block rounded-lg bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Upload CSV
          </Link>
        </section>
      </SectionPageShell>
    );
  }

  return (
    <SectionPageShell
      eyebrow="Attention Centre"
      title="What do I need to act on today?"
      description="Operational dashboard showing only fire exit items that require attention, investigation, or recognition."
    >
      {filters ? (
        <AttentionCentreFiltersBar
          dashboard={dashboard}
          filters={filters}
          onChange={handleFiltersChange}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Critical", value: dashboard.summary.criticalCount, accent: "text-red-400" },
          {
            label: "Needs investigation",
            value: dashboard.summary.investigationCount,
            accent: "text-amber-400",
          },
          {
            label: "Improvements",
            value: dashboard.summary.improvementCount,
            accent: "text-emerald-400",
          },
          {
            label: "Recommendations",
            value: dashboard.summary.recommendationCount,
            accent: "text-cyan-400",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="🔴 Critical"
        description="Issues requiring immediate action."
        count={dashboard.critical.length}
      >
        {dashboard.critical.length === 0 ? (
          <p className="text-sm text-slate-500">No critical items right now.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Door</th>
                  <th className="px-3 py-2">Issue</th>
                  <th className="px-3 py-2">Current risk</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.critical.map((item) => (
                  <tr key={item.id} className="border-t border-slate-800">
                    <td className="px-3 py-3">
                      <DoorLink door={item.door} />
                      <p className="mt-1 text-xs text-slate-500">{item.building}</p>
                    </td>
                    <td className="px-3 py-3 text-slate-300">{item.issue}</td>
                    <td className={`px-3 py-3 font-semibold ${RISK_STYLES[item.currentRisk]}`}>
                      {item.currentRisk}
                    </td>
                    <td className="px-3 py-3 text-slate-300">{item.durationLabel}</td>
                    <td className="px-3 py-3">
                      <Link
                        href={item.actionHref}
                        className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/25"
                      >
                        {item.actionLabel}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="🟠 Needs Investigation"
        description="Recurring patterns that warrant a closer look."
        count={dashboard.needsInvestigation.length}
      >
        {dashboard.needsInvestigation.length === 0 ? (
          <p className="text-sm text-slate-500">No investigation items detected.</p>
        ) : (
          <div className="space-y-3">
            {dashboard.needsInvestigation.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <DoorLink door={item.door} />
                    <p className="mt-1 text-sm font-medium text-amber-300">
                      {item.pattern}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">{item.evidence}</p>
                    <p className="mt-2 text-sm text-slate-300">
                      {item.suggestedInvestigation}
                    </p>
                  </div>
                  <Link
                    href={item.investigateHref}
                    className="rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/30 hover:bg-amber-500/25"
                  >
                    Investigate
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="🟢 Improvements"
        description="Positive changes worth recognising."
        count={dashboard.improvements.length}
      >
        {dashboard.improvements.length === 0 ? (
          <p className="text-sm text-slate-500">No improvements identified yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {dashboard.improvements.map((item) => (
              <article
                key={item.id}
                className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4"
              >
                <DoorLink door={item.door} />
                <p className="mt-2 text-sm font-medium text-emerald-300">
                  {item.improvement}
                </p>
                <p className="mt-1 text-sm text-slate-400">{item.impact}</p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Recommendations"
        description="Prioritised operational recommendations from the existing compliance engine."
        count={dashboard.summary.recommendationCount}
      >
        <div className="space-y-6">
          {(["critical", "high", "medium", "low"] as const).map((tier) => (
            <div key={tier}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                {tier}
              </h3>
              {dashboard.recommendations[tier].length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No {tier} recommendations.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {dashboard.recommendations[tier].map((item) => (
                    <article
                      key={item.id}
                      className={`rounded-xl border p-4 ${TIER_STYLES[tier]}`}
                    >
                      <p className="font-semibold text-white">{item.title}</p>
                      {item.door ? (
                        <p className="mt-1 text-sm text-slate-400">
                          <DoorLink door={item.door} /> · {item.building}
                        </p>
                      ) : (
                        <p className="mt-1 text-sm text-slate-400">{item.building}</p>
                      )}
                      <dl className="mt-3 space-y-2 text-sm">
                        <div>
                          <dt className="font-medium text-slate-300">Why this matters</dt>
                          <dd className="text-slate-400">{item.whyThisMatters}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-300">Recommended action</dt>
                          <dd className="text-slate-400">{item.recommendedAction}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-slate-300">Expected benefit</dt>
                          <dd className="text-slate-400">{item.expectedBenefit}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </SectionPageShell>
  );
}
