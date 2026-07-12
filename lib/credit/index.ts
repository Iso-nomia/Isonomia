/**
 * Phase 4.3: Academic Credit Integration
 * Barrel export for credit services
 */

export * from "./types";
export {
  getOrcidAuthUrl,
  connectOrcid,
  getOrcidConnection,
  disconnectOrcid,
  toggleAutoSync,
  pushWorkToOrcid,
  syncAllToOrcid,
  getSyncedWorks,
} from "./orcidService";
export { generateCvExport, getUserExports } from "./cvExportService";
export {
  generateInstitutionalReport,
  getInstitutionalReports,
  getInstitutionalReportById,
  getComparativeStats,
} from "./institutionalReportService";
