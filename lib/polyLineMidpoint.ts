/**
 * Decode an encoded polyline string into an array of [lat, lng] pairs.
 * Implements the standard Google Encoded Polyline Algorithm.
 */
function decode(encoded: string, precision = 5): [number, number][] {
  const factor = Math.pow(10, precision);
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

/**
 * Given the encoded polyline & total distance (metres),
 * return the lat/lng at half the distance along the route.
 */
export function halfwayPoint(encoded: string): { lat: number; lng: number } {
  const coords = decode(encoded, 5);          // [[lat,lng], …]
  // crude cumulative‑distance walk
  const haversine = (a: number[], b: number[]) => {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const [lat1, lon1] = a.map(toRad);
    const [lat2, lon2] = b.map(toRad);
    const dLat = lat2 - lat1, dLon = lon2 - lon1;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const segLengths = coords.slice(1).map((c, i) => haversine(coords[i], c));
  const total = segLengths.reduce((s, v) => s + v, 0);
  let acc = 0;
  let i = 0;
  while (i < segLengths.length && acc + segLengths[i] < total / 2) {
    acc += segLengths[i++];
  }
  return { lat: coords[i][0], lng: coords[i][1] };
}
