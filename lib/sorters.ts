import { Venue } from "@/lib/dedupeVenues";

export type LatLng = { lat: number; lng: number };

export const haversineDistance = (a: LatLng, b: LatLng): number => {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const lat1 = a.lat * rad;
  const lat2 = b.lat * rad;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371e3 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const sortByRating = (a: Venue, b: Venue) => (b.rating ?? 0) - (a.rating ?? 0);

export const sortByPrice = (a: Venue & { price_level?: number }, b: Venue & { price_level?: number }) =>
  (a.price_level ?? Number.POSITIVE_INFINITY) - (b.price_level ?? Number.POSITIVE_INFINITY);

export const sortByDistance = (midpoint: LatLng) => (a: Venue, b: Venue) =>
  haversineDistance(a.location, midpoint) - haversineDistance(b.location, midpoint);
