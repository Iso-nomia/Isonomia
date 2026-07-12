export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const res = await fetch(
    `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address!)}&key=${apiKey}&libraries=drawing`
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Failed to fetch from Google API" }, { status: res.status });
  }

  const data = await res.json();
  if (!data.results || data.results.length === 0) {
    return NextResponse.json({ error: "No results found" }, { status: 404 });
  }

  return NextResponse.json(data.results[0].geometry.location);
}



