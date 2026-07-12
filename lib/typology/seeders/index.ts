/**
 * Typology — Seeder registry barrel
 */

export { interventionSeeder } from "./interventionSeeder";
export { metricSeeder } from "./metricSeeder";
export { repeatedAttackSeeder } from "./repeatedAttackSeeder";
export { valueLexiconSeeder } from "./valueLexiconSeeder";
export type {
  AnySeederDescriptor,
  EventSeederContext,
  EventSeederDescriptor,
  SeederDescriptor,
  SeederOutput,
} from "./types";

import { interventionSeeder } from "./interventionSeeder";
import { metricSeeder } from "./metricSeeder";
import type { EventSeederDescriptor } from "./types";

/** Returns the event-driven seeders enabled by the given flag map. */
export function enabledEventSeeders(
  featureFlags: Record<string, boolean> = {},
): EventSeederDescriptor[] {
  const all: EventSeederDescriptor[] = [interventionSeeder, metricSeeder];
  return all.filter((s) => {
    const v = featureFlags[s.flag];
    if (v === false) return false;
    if (v === true) return true;
    return s.defaultEnabled;
  });
}
