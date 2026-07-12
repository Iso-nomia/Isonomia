export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") ?? "1500";
  const venueType = searchParams.get("type") ?? "restaurant";

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "Latitude and longitude are required." },
      { status: 400 }
    );
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  const apiUrl =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
    `location=${lat},${lng}&radius=${radius}&type=${venueType}&key=${apiKey}`;

  const res = await fetch(apiUrl);
  if (!res.ok) {
    return NextResponse.json(
      { error: "Failed to fetch places." },
      { status: res.status }
    );
  }

  const data = await res.json();

  if (!Array.isArray(data.results)) {
    return NextResponse.json({ results: [] });
  }

  const detailResults = await Promise.all(
    data.results.map(async (place: any) => {
      const detailUrl =
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}` +
        `&fields=name,formatted_address,opening_hours,rating,types&key=${apiKey}`;

      const detailRes = await fetch(detailUrl);
      if (!detailRes.ok) {
        return place;
      }
      const detailData = await detailRes.json();
      return { ...place, ...detailData.result };
    })
  );

  return NextResponse.json({ results: detailResults });
}
