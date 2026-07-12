/**
 * ASPIC+ Translation Layer
 * 
 * Bidirectional translation between AIF PA-nodes and ASPIC+ preferences
 * per Bex, Prakken, Reed (2013) formal definitions.
 * 
 * Main exports:
 * - evaluateWithAIFPreferences: Main evaluation entry point
 * - syncPreferencesToAIF: Sync ASPIC+ preferences back to AIF
 * - populateKBPreferencesFromAIF: AIF → ASPIC+ translation
 * - createPANodesFromASPICPreferences: ASPIC+ → AIF translation
 */

// AIF → ASPIC+ Translation (Definition 4.1)
export {
  populateKBPreferencesFromAIF,
  computeTransitiveClosure,
  detectPreferenceCycles,
  getDetailedPreferences,
  preferenceExists,
} from "./aifToASPIC";

// ASPIC+ → AIF Translation (Definition 4.2)
export {
  createPANodesFromASPICPreferences,
  batchCreatePANodesFromASPICPreferences,
  deletePANodesFromASPICPreferences,
} from "./aspicToAIF";

// High-level Integration
export {
  evaluateWithAIFPreferences,
  syncPreferencesToAIF,
  validateRoundTripTranslation,
  getPreferenceStatistics,
  clearAllPreferences,
  compareOrderings,
  type EvaluationResult,
} from "./integration";
