export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

/* ───────── helpers (no external deps) ───────── */

// Google’s polyline algorithm — minimal decode
function decodePolyline(str: string): [number, number][] {
  let index = 0,
    lat = 0,
    lng = 0,
    coords: [number, number][] = [];

  const shift = () => {
    let result = 0,
      shift = 0,
      b: number;
    do {
      b = str.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return (result & 1) ? ~(result >> 1) : result >> 1;
  };

  while (index < str.length) {
    lat += shift();
    lng += shift();
    coords.push([lat * 1e-5, lng * 1e-5]);
  }
  return coords;
}

// Haversine distance in metres
function hav(a: [number, number], b: [number, number]) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1, lat2, lon2] = [a[0], a[1], b[0], b[1]].map(toRad);
  const dLat = lat2 - lat1, dLon = lon2 - lon1;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h)); // metres
}

/* ───────── main handler ───────── */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const origin = searchParams.get("origin");
  const destination = searchParams.get("destination");
  if (!origin || !destination)
    return NextResponse.json({ error: "origin and destination required" }, { status: 400 });

  const [oLat, oLng] = origin.split(",").map(Number);
  const [dLat, dLng] = destination.split(",").map(Number);

  /* build Google payload */
  const body = {
    origin: { location: { latLng: { latitude: oLat, longitude: oLng } } },
    destination: { location: { latLng: { latitude: dLat, longitude: dLng } } },
    travelMode: "DRIVE",
  };

  /* proxy call */
  const proxy = new URL("/api/googleProxy", req.url);
  proxy.searchParams.set("endpoint", "directions/v2:computeRoutes");

  const gRes = await fetch(proxy.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-FieldMask": "*" },
    body: JSON.stringify(body),
  });

  if (!gRes.ok) {
    return NextResponse.json(
      { error: "Google proxy failed", detail: await gRes.text() },
      { status: gRes.status },
    );
  }

  const gData = await gRes.json();
  if (!gData.routes?.length || !gData.routes[0].polyline?.encodedPolyline) {
    return NextResponse.json({ error: "No route returned" }, { status: 502 });
  }

  /* decode polyline & walk to half‑distance */
  const coords = decodePolyline(gData.routes[0].polyline.encodedPolyline);
  const seg = coords.slice(1).map((c, i) => hav(coords[i], c));
  const total = seg.reduce((s, v) => s + v, 0);
  let acc = 0, i = 0;
  while (i < seg.length && acc + seg[i] < total / 2) acc += seg[i++];
  const ratio = (total / 2 - acc) / seg[i];          // 0‥1 within segment
  const [lat1, lon1] = coords[i];
  const [lat2, lon2] = coords[i + 1];
  const midpoint = {
    lat: lat1 + (lat2 - lat1) * ratio,
    lng: lon1 + (lon2 - lon1) * ratio,
  };

  return NextResponse.json({ midpoint, routes: gData.routes });
}
