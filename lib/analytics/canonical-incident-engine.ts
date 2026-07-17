import { ANALYTICS_ENGINE_VERSION } from "./analytics-engine-version";
import {
  buildDerivedIncidentsFromSessions,
  buildNativeAlarmIncidents,
} from "./compliance-incidents";
import {
  attachImportMetadata,
  dedupeIncidents,
  dedupeParsedEvents,
} from "./dedupe-parsed-events";
import { pairDoorOpenCloseSessions } from "./door-open-close-pairing";
import { groupEventsByDoor } from "./parse-events";
import { sortEventsDeterministic } from "./sort-events";
import type { IncidentEngineDiagnostics } from "./incident-trace";
import type {
  ComplianceIncident,
  FireExitAnalyticsConfig,
  ParsedFireExitEvent,
} from "./types";

/** Maximum gap allowed when carrying an unmatched open into the next import. */
export const MAX_CARRY_FORWARD_MS = 2 * 60 * 60 * 1000;

export type ImportContext = {
  importId: string;
  reportingPeriodStart: string | null;
  reportingPeriodEnd: string | null;
  createdAt: string;
};

export type CanonicalIncidentEngineInput = {
  eventsByImportId: Map<string, ParsedFireExitEvent[]>;
  importContexts?: Map<string, ImportContext>;
  config: FireExitAnalyticsConfig;
  includeTrace?: boolean;
};

export type CanonicalIncidentEngineResult = {
  incidentsByDoor: Map<string, ComplianceIncident[]>;
  dedupedEvents: ParsedFireExitEvent[];
  diagnostics: IncidentEngineDiagnostics;
  analyticsEngineVersion: string;
};

function sortImportIds(
  eventsByImportId: Map<string, ParsedFireExitEvent[]>,
  importContexts?: Map<string, ImportContext>,
): string[] {
  return [...eventsByImportId.keys()].sort((a, b) => {
    const ctxA = importContexts?.get(a);
    const ctxB = importContexts?.get(b);

    const startA = ctxA?.reportingPeriodStart
      ? new Date(ctxA.reportingPeriodStart).getTime()
      : ctxA?.createdAt
        ? new Date(ctxA.createdAt).getTime()
        : 0;
    const startB = ctxB?.reportingPeriodStart
      ? new Date(ctxB.reportingPeriodStart).getTime()
      : ctxB?.createdAt
        ? new Date(ctxB.createdAt).getTime()
        : 0;

    if (startA !== startB) {
      return startA - startB;
    }

    return a.localeCompare(b);
  });
}

export function shouldExpirePendingOpenAtImport(
  pending: ParsedFireExitEvent,
  currentContext: ImportContext | undefined,
  firstEventTimestamp: number | null,
): boolean {
  if (firstEventTimestamp != null) {
    if (firstEventTimestamp - pending.timestamp > MAX_CARRY_FORWARD_MS) {
      return true;
    }
  }

  if (currentContext) {
    const anchor = currentContext.reportingPeriodStart
      ? new Date(currentContext.reportingPeriodStart).getTime()
      : new Date(currentContext.createdAt).getTime();

    if (anchor - pending.timestamp > MAX_CARRY_FORWARD_MS) {
      return true;
    }
  }

  return false;
}

export function areImportsContiguousForCarryForward(
  previous: ImportContext | undefined,
  next: ImportContext | undefined,
  pendingOpenTimestamp: number,
  nextEventTimestamp: number,
): boolean {
  if (!previous || !next) {
    return (
      nextEventTimestamp - pendingOpenTimestamp <= MAX_CARRY_FORWARD_MS &&
      nextEventTimestamp >= pendingOpenTimestamp
    );
  }

  if (previous.reportingPeriodEnd && next.reportingPeriodStart) {
    const prevEnd = new Date(previous.reportingPeriodEnd).getTime();
    const nextStart = new Date(next.reportingPeriodStart).getTime();
    const gap = nextStart - prevEnd;
    if (gap > MAX_CARRY_FORWARD_MS) {
      return false;
    }
  }

  return (
    nextEventTimestamp - pendingOpenTimestamp <= MAX_CARRY_FORWARD_MS &&
    nextEventTimestamp >= pendingOpenTimestamp
  );
}

function mergeExplicitAndDerivedIncidents(
  explicit: ComplianceIncident[],
  derived: ComplianceIncident[],
): ComplianceIncident[] {
  return dedupeIncidents([...explicit, ...derived]).sort(
    (a, b) => a.startTimestamp - b.startTimestamp,
  );
}

function buildIncidentsForImportDoor(
  doorEvents: ParsedFireExitEvent[],
  config: FireExitAnalyticsConfig,
  initialPendingOpen: ParsedFireExitEvent | null,
  includeTrace?: boolean,
): {
  incidents: ComplianceIncident[];
  pendingOpen: ParsedFireExitEvent | null;
  orphanCloses: ParsedFireExitEvent[];
  crossImportPairs: number;
  expiredUnmatchedOpens: ParsedFireExitEvent[];
} {
  const sorted = sortEventsDeterministic(doorEvents);
  const explicit = buildNativeAlarmIncidents(sorted, config, { includeTrace });
  const pairing = pairDoorOpenCloseSessions(sorted, {
    initialPendingOpen,
  });
  const validSessions = pairing.sessions.filter(
    (session) => session.durationSeconds * 1000 <= MAX_CARRY_FORWARD_MS,
  );
  const rejectedSessions = pairing.sessions.filter(
    (session) => session.durationSeconds * 1000 > MAX_CARRY_FORWARD_MS,
  );
  const derived = buildDerivedIncidentsFromSessions(
    validSessions,
    config,
    { includeTrace },
  );

  return {
    incidents: mergeExplicitAndDerivedIncidents(explicit, derived),
    pendingOpen: pairing.pendingOpen,
    orphanCloses: [
      ...pairing.orphanCloses,
      ...rejectedSessions.map((session) => session.closeEvent),
    ],
    crossImportPairs: validSessions.filter((session) => session.crossImport)
      .length,
    expiredUnmatchedOpens: rejectedSessions.map((session) => session.openEvent),
  };
}

export function buildCanonicalIncidentsByDoor(
  input: CanonicalIncidentEngineInput,
): CanonicalIncidentEngineResult {
  const importIds = sortImportIds(
    input.eventsByImportId,
    input.importContexts,
  );

  const incidentsByDoor = new Map<string, ComplianceIncident[]>();
  const diagnostics: IncidentEngineDiagnostics = {
    orphanCloses: [],
    expiredUnmatchedOpens: [],
    crossImportPairs: 0,
  };

  const pendingOpenByDoor = new Map<string, ParsedFireExitEvent>();
  const doorNames = new Set<string>();

  for (const importEvents of input.eventsByImportId.values()) {
    for (const event of importEvents) {
      doorNames.add(event.door);
    }
  }

  let previousImportId: string | null = null;

  for (const importId of importIds) {
    const importEvents = attachImportMetadata(
      input.eventsByImportId.get(importId) ?? [],
      importId,
    );
    const grouped = groupEventsByDoor(importEvents);
    const previousContext = previousImportId
      ? input.importContexts?.get(previousImportId)
      : undefined;
    const currentContext = input.importContexts?.get(importId);

    for (const door of doorNames) {
      const doorEvents = grouped.get(door) ?? [];
      if (doorEvents.length === 0 && !pendingOpenByDoor.has(door)) {
        continue;
      }

      let initialPending = pendingOpenByDoor.get(door) ?? null;

      if (initialPending) {
        const firstEventTimestamp =
          doorEvents.length > 0
            ? sortEventsDeterministic(doorEvents)[0]!.timestamp
            : null;

        let expirePending = shouldExpirePendingOpenAtImport(
          initialPending,
          currentContext,
          firstEventTimestamp,
        );

        if (
          !expirePending &&
          initialPending &&
          doorEvents.length > 0 &&
          input.importContexts
        ) {
          expirePending = !areImportsContiguousForCarryForward(
            previousContext,
            currentContext,
            initialPending.timestamp,
            firstEventTimestamp!,
          );
        } else if (!expirePending && initialPending && doorEvents.length > 0) {
          expirePending = true;
        }

        if (expirePending) {
          diagnostics.expiredUnmatchedOpens.push(initialPending);
          initialPending = null;
          pendingOpenByDoor.delete(door);
        }
      }

      if (doorEvents.length === 0 && !initialPending) {
        continue;
      }

      const result = buildIncidentsForImportDoor(
        doorEvents,
        input.config,
        initialPending,
        input.includeTrace,
      );

      diagnostics.orphanCloses.push(...result.orphanCloses);
      diagnostics.expiredUnmatchedOpens.push(...result.expiredUnmatchedOpens);
      diagnostics.crossImportPairs += result.crossImportPairs;

      if (result.pendingOpen) {
        pendingOpenByDoor.set(door, result.pendingOpen);
      } else {
        pendingOpenByDoor.delete(door);
      }

      if (result.incidents.length > 0) {
        const existing = incidentsByDoor.get(door) ?? [];
        incidentsByDoor.set(
          door,
          dedupeIncidents([...existing, ...result.incidents]),
        );
      }
    }

    previousImportId = importId;
  }

  for (const pending of pendingOpenByDoor.values()) {
    diagnostics.expiredUnmatchedOpens.push(pending);
  }

  const dedupedEvents = dedupeParsedEvents(
    importIds.flatMap((importId) =>
      attachImportMetadata(
        input.eventsByImportId.get(importId) ?? [],
        importId,
      ),
    ),
  );

  return {
    incidentsByDoor,
    dedupedEvents,
    diagnostics,
    analyticsEngineVersion: ANALYTICS_ENGINE_VERSION,
  };
}

export function buildIncidentsByDoorFromImportGroups(
  eventsByImportId: Map<string, ParsedFireExitEvent[]>,
  config: FireExitAnalyticsConfig,
  importContexts?: Map<string, ImportContext>,
): Map<string, ComplianceIncident[]> {
  return buildCanonicalIncidentsByDoor({
    eventsByImportId,
    importContexts,
    config,
  }).incidentsByDoor;
}

export function buildDedupedEventsFromImportGroups(
  eventsByImportId: Map<string, ParsedFireExitEvent[]>,
): ParsedFireExitEvent[] {
  return buildCanonicalIncidentsByDoor({
    eventsByImportId,
    config: { heldOpenThresholdSeconds: 30 },
  }).dedupedEvents;
}

export function countCanonicalIncidents(
  incidentsByDoor: Map<string, ComplianceIncident[]>,
): number {
  let total = 0;
  for (const incidents of incidentsByDoor.values()) {
    total += incidents.length;
  }
  return total;
}

export function traceIncidentsForDoor(
  door: string,
  input: CanonicalIncidentEngineInput,
): ComplianceIncident[] {
  return buildCanonicalIncidentsByDoor({
    ...input,
    includeTrace: true,
  }).incidentsByDoor.get(door) ?? [];
}
