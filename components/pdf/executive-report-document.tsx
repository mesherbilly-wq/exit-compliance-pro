import React from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { ExecutiveReportPdfData } from "@/lib/reports/executive-report-pdf-types";
import { getTimeBeyondThresholdHeading } from "@/lib/reports/executive-report-pdf-types";

const colors = {
  slate900: "#0f172a",
  slate700: "#334155",
  slate500: "#64748b",
  slate200: "#e2e8f0",
  cyan600: "#0891b2",
  cyan500: "#06b6d4",
  white: "#ffffff",
  emerald700: "#047857",
  amber700: "#b45309",
  red700: "#b91c1c",
};

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.white,
    paddingTop: 36,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 10,
    color: colors.slate700,
    fontFamily: "Helvetica",
  },
  header: {
    borderBottomWidth: 2,
    borderBottomColor: colors.cyan500,
    paddingBottom: 14,
    marginBottom: 18,
  },
  brand: {
    fontSize: 9,
    color: colors.cyan600,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: 700,
  },
  title: {
    fontSize: 22,
    color: colors.slate900,
    fontWeight: 700,
    marginTop: 6,
  },
  subtitle: {
    fontSize: 10,
    color: colors.slate500,
    marginTop: 4,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  metaBlock: {
    width: "48%",
  },
  metaLabel: {
    fontSize: 8,
    color: colors.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metaValue: {
    fontSize: 11,
    color: colors.slate900,
    marginTop: 3,
    fontWeight: 700,
  },
  sectionTitle: {
    fontSize: 12,
    color: colors.slate900,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  kpiCard: {
    width: "31%",
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 6,
    padding: 10,
    minHeight: 58,
  },
  kpiLabel: {
    fontSize: 8,
    color: colors.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  kpiValue: {
    fontSize: 16,
    color: colors.slate900,
    fontWeight: 700,
    marginTop: 4,
  },
  kpiDetail: {
    fontSize: 8,
    color: colors.slate500,
    marginTop: 3,
    lineHeight: 1.35,
  },
  scoreCard: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  scoreValue: {
    fontSize: 34,
    color: colors.slate900,
    fontWeight: 700,
  },
  healthBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#ecfeff",
    color: colors.cyan600,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  table: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 6,
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  tableCellRank: { width: "8%" },
  tableCellDoor: { width: "24%" },
  tableCellMeta: { width: "68%" },
  tableHeaderText: {
    fontSize: 8,
    color: colors.slate500,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: 700,
  },
  tableText: {
    fontSize: 9,
    color: colors.slate700,
    lineHeight: 1.35,
  },
  tableTextStrong: {
    fontSize: 9,
    color: colors.slate900,
    fontWeight: 700,
  },
  trendRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.slate200,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  recommendation: {
    borderWidth: 1,
    borderColor: colors.slate200,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 10,
    color: colors.slate900,
    fontWeight: 700,
    marginBottom: 3,
  },
  recommendationBody: {
    fontSize: 9,
    color: colors.slate700,
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    left: 40,
    right: 40,
    bottom: 20,
    borderTopWidth: 1,
    borderTopColor: colors.slate200,
    paddingTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 8,
    color: colors.slate500,
  },
  pageBreakSection: {
    marginTop: 8,
  },
});

type ExecutiveReportDocumentProps = {
  data: ExecutiveReportPdfData;
};

function PageFooter({ generatedAtLabel }: { generatedAtLabel: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Exit Compliance Pro · Management Review</Text>
      <Text
        style={styles.footerText}
        render={({ pageNumber, totalPages }) =>
          `Page ${pageNumber} of ${totalPages} · Generated ${generatedAtLabel}`
        }
      />
    </View>
  );
}

function KpiCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {detail ? <Text style={styles.kpiDetail}>{detail}</Text> : null}
    </View>
  );
}

export function ExecutiveReportDocument({ data }: ExecutiveReportDocumentProps) {
  const tbtLabel = getTimeBeyondThresholdHeading();

  return (
    <Document title={`${data.productName} · ${data.reportTitle}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>{data.productName}</Text>
          <Text style={styles.title}>{data.reportTitle}</Text>
          <Text style={styles.subtitle}>
            Fire exit intelligence summary for directors and facilities managers
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Report date</Text>
              <Text style={styles.metaValue}>{data.reportDateLabel}</Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Reporting period</Text>
              <Text style={styles.metaValue}>{data.reportingPeriodLabel}</Text>
            </View>
          </View>
          <Text style={[styles.subtitle, { marginTop: 8 }]}>
            Source: {data.sourceFileName}
          </Text>
        </View>

        <View style={styles.scoreCard}>
          <View>
            <Text style={styles.sectionTitle}>Overall compliance score</Text>
            <Text style={styles.scoreValue}>{data.overallComplianceScore}%</Text>
            <Text style={styles.kpiDetail}>
              Trend: {data.complianceTrendDirection} · {data.complianceTrendLabel}
            </Text>
          </View>
          <View style={{ maxWidth: "45%" }}>
            <Text style={styles.sectionTitle}>Site health rating</Text>
            <Text style={styles.healthBadge}>{data.siteHealthRating}</Text>
            <Text style={[styles.kpiDetail, { marginTop: 8 }]}>
              {data.siteHealthSummary}
            </Text>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <KpiCard label="Doors monitored" value={String(data.doorsMonitored)} />
          <KpiCard
            label="Compliance incidents"
            value={String(data.complianceIncidents)}
          />
          <KpiCard label={tbtLabel} value={data.timeBeyondThresholdLabel} />
          <KpiCard
            label="Longest incident"
            value={data.longestIncidentLabel}
            detail={data.longestIncidentDoor}
          />
          <KpiCard
            label="Highest-risk door"
            value={data.highestRiskDoor}
            detail={data.highestRiskDoorDetail}
          />
          <KpiCard
            label="Compliance trend"
            value={data.complianceTrendDirection}
            detail={data.complianceTrendLabel}
          />
        </View>

        <PageFooter generatedAtLabel={data.generatedAtLabel} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Top 5 compliance risks</Text>
        <View style={styles.table} wrap={false}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, styles.tableCellRank]}>#</Text>
            <Text style={[styles.tableHeaderText, styles.tableCellDoor]}>Door</Text>
            <Text style={[styles.tableHeaderText, styles.tableCellMeta]}>Summary</Text>
          </View>
          {data.topComplianceRisks.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={styles.tableText}>
                No compliance risks identified in the analysed period.
              </Text>
            </View>
          ) : (
            data.topComplianceRisks.map((row) => (
              <View key={`risk-${row.rank}-${row.door}`} style={styles.tableRow} wrap={false}>
                <Text style={[styles.tableTextStrong, styles.tableCellRank]}>
                  {row.rank}
                </Text>
                <Text style={[styles.tableTextStrong, styles.tableCellDoor]}>
                  {row.door}
                </Text>
                <Text style={[styles.tableText, styles.tableCellMeta]}>
                  {row.riskRating} risk · {row.complianceScore}% compliance · Trend:{" "}
                  {row.trend}. {row.summary}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.pageBreakSection}>
          <Text style={styles.sectionTitle}>Top improvements</Text>
          <View style={styles.table} wrap={false}>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.tableCellRank]}>#</Text>
              <Text style={[styles.tableHeaderText, styles.tableCellDoor]}>Door</Text>
              <Text style={[styles.tableHeaderText, styles.tableCellMeta]}>Summary</Text>
            </View>
            {data.topImprovements.length === 0 ? (
              <View style={styles.tableRow}>
                <Text style={styles.tableText}>
                  No improving exits identified in the analysed period.
                </Text>
              </View>
            ) : (
              data.topImprovements.map((row) => (
                <View
                  key={`improvement-${row.rank}-${row.door}`}
                  style={styles.tableRow}
                  wrap={false}
                >
                  <Text style={[styles.tableTextStrong, styles.tableCellRank]}>
                    {row.rank}
                  </Text>
                  <Text style={[styles.tableTextStrong, styles.tableCellDoor]}>
                    {row.door}
                  </Text>
                  <Text style={[styles.tableText, styles.tableCellMeta]}>
                    {row.complianceScore}% compliance · Trend: {row.trend}. {row.summary}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        <PageFooter generatedAtLabel={data.generatedAtLabel} />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Weekly time beyond threshold trend</Text>
        <View style={styles.table} wrap={false}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { width: "34%" }]}>Period</Text>
            <Text style={[styles.tableHeaderText, { width: "33%" }]}>Incidents</Text>
            <Text style={[styles.tableHeaderText, { width: "33%" }]}>
              {tbtLabel}
            </Text>
          </View>
          {data.weeklyTrend.length === 0 ? (
            <View style={styles.trendRow}>
              <Text style={styles.tableText}>Insufficient trend data for this period.</Text>
            </View>
          ) : (
            data.weeklyTrend.map((row) => (
              <View key={row.label} style={styles.trendRow} wrap={false}>
                <Text style={[styles.tableText, { width: "34%" }]}>{row.label}</Text>
                <Text style={[styles.tableText, { width: "33%" }]}>{row.incidents}</Text>
                <Text style={[styles.tableText, { width: "33%" }]}>
                  {row.timeBeyondThresholdLabel}
                </Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.pageBreakSection}>
          <Text style={styles.sectionTitle}>Operational recommendations</Text>
          {data.recommendations.length === 0 ? (
            <Text style={styles.tableText}>
              No operational recommendations were generated for this period.
            </Text>
          ) : (
            data.recommendations.map((item, index) => (
              <View key={`${item.title}-${index}`} style={styles.recommendation} wrap={false}>
                <Text style={styles.recommendationTitle}>
                  [{item.priority.toUpperCase()}] {item.title}
                </Text>
                <Text style={styles.recommendationBody}>{item.summary}</Text>
                <Text style={[styles.recommendationBody, { marginTop: 4 }]}>
                  Action: {item.action}
                </Text>
              </View>
            ))
          )}
        </View>

        <PageFooter generatedAtLabel={data.generatedAtLabel} />
      </Page>
    </Document>
  );
}
