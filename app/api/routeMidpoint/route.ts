export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat1 = searchParams.get("lat1");
  const lng1 = searchParams.get("lng1");
  const lat2 = searchParams.get("lat2");
  const lng2 = searchParams.get("lng2");

  if (!lat1 || !lng1 || !lat2 || !lng2) {
    return NextResponse.json(
      { error: "Coordinates required" },
      { status: 400 }
    );
  }

  const url = new URL("/api/googleProxy", req.url);
  url.searchParams.set("endpoint", "directions/json");
  url.searchParams.set("origin", `${lat1},${lng1}`);
  url.searchParams.set("destination", `${lat2},${lng2}`);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (!res.ok || data.error) {
    return NextResponse.json(
      typeof data.error === "string" ? { error: data.error } : data,
      { status: res.status }
    );
  }
  if (!data.routes || data.routes.length === 0 || data.status !== "OK") {
    const rad = Math.PI / 180;
    const la1 = parseFloat(lat1) * rad;
    const la2 = parseFloat(lat2) * rad;
    const lo1 = parseFloat(lng1) * rad;
    const dLon = (parseFloat(lng2) - parseFloat(lng1)) * rad;
    const bx = Math.cos(la2) * Math.cos(dLon);
    const by = Math.cos(la2) * Math.sin(dLon);
    const lat = Math.atan2(
      Math.sin(la1) + Math.sin(la2),
      Math.sqrt((Math.cos(la1) + bx) ** 2 + by * by)
    );
    const lng = lo1 + Math.atan2(by, Math.cos(la1) + bx);
    return NextResponse.json({ lat: lat / rad, lng: lng / rad });
  }

  const legs = data.routes[0].legs;
  let totalDistance = 0;
  legs.forEach((leg: any) => {
    totalDistance += leg.distance.value;
  });
  let half = totalDistance / 2;
  let traveled = 0;

  for (const leg of legs) {
    for (const step of leg.steps) {
      const stepDistance = step.distance.value;
      if (traveled + stepDistance >= half) {
        const remaining = half - traveled;
        const ratio = remaining / stepDistance;
        const start = step.start_location;
        const end = step.end_location;
        const lat = start.lat + (end.lat - start.lat) * ratio;
        const lng = start.lng + (end.lng - start.lng) * ratio;
        return NextResponse.json({ lat, lng });
      }
      traveled += stepDistance;
    }
  }

  const lastLeg = legs[legs.length - 1];
  const lastStep = lastLeg.steps[lastLeg.steps.length - 1];
  return NextResponse.json({
    lat: lastStep.end_location.lat,
    lng: lastStep.end_location.lng,
  });
}
