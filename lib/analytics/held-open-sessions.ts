export {
  buildComplianceIncidents,
  getIncidentDurationBucket,
  getIncidentRiskRating,
} from "./compliance-incidents";

/** @deprecated Use buildComplianceIncidents */
export { buildComplianceIncidents as buildHeldOpenSessions } from "./compliance-incidents";
