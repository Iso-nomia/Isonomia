/**
 * Typology — Public surface barrel.
 *
 * Re-exports the service entrypoints used by API routes, subscribers, and
 * tests. Mirrors `lib/facilitation/index.ts` discipline.
 */

export * as types from "./types";
export * as schemas from "./schemas";
export * as axisRegistry from "./axisRegistry";
export * as tagService from "./tagService";
export * as candidateService from "./candidateService";
export * as summaryService from "./summaryService";
export * as typologyEventService from "./typologyEventService";
export * as eventBus from "./eventBus";
export * as auth from "./auth";
export * as hashChain from "./hashChain";

export { wireTypologyFacilitationSubscriber } from "./subscribers/facilitationSeeder";
export {
  interventionSeeder,
  metricSeeder,
  repeatedAttackSeeder,
  valueLexiconSeeder,
  enabledEventSeeders,
} from "./seeders";
