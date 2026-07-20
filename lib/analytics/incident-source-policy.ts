import type { ParsedFireExitEvent } from "./types";

export const GENETEC_SOURCE_SYSTEM = "genetec";

export type IncidentSourcePolicy =
  | "genetec_native_alarm_only"
  | "open_close_and_native";

export function isGenetecSource(sourceSystem?: string): boolean {
  return !sourceSystem || sourceSystem === GENETEC_SOURCE_SYSTEM;
}

export function resolveIncidentPolicyForEvents(
  events: ParsedFireExitEvent[],
): IncidentSourcePolicy {
  if (events.length === 0) {
    return "genetec_native_alarm_only";
  }

  if (events.every((event) => isGenetecSource(event.sourceSystem))) {
    return "genetec_native_alarm_only";
  }

  return "open_close_and_native";
}
