import uniqBy from "lodash/uniqBy";
// fast-levenshtein ships no type declarations and cannot be augmented.
// @ts-ignore
import { get as levenshtein } from "fast-levenshtein";

export type Venue = {
  id: string;
  name: string;
  address: string;
  location: { lat: number; lng: number };
  rating?: number;
  price_level?: number;
  openingHours?: string[];
  openNow?: boolean;
  distance?: number;
  types?: string[];
};

export const dedupeByPlaceId = (arr: Venue[]): Venue[] => {
  const uniqueById = uniqBy(arr, "id");

  const deduped: Venue[] = [];
  for (const venue of uniqueById) {
    const duplicate = deduped.find(
      (v) =>
        levenshtein(
          (v.name + v.address).toLowerCase(),
          (venue.name + venue.address).toLowerCase()
        ) < 3
    );
    if (!duplicate) {
      deduped.push(venue);
    }
  }

  return deduped;
};
