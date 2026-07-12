export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { searchUsersByAttributes } from "@/lib/actions/userattributes.actions";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const getAll = (key: string) => params.getAll(key);
  const base = {
    artists: getAll("artists"),
    albums: getAll("albums"),
    songs: getAll("songs"),
    interests: getAll("interests"),
    movies: getAll("movies"),
    books: getAll("books"),
    hobbies: getAll("hobbies"),
    communities: getAll("communities"),
    location: params.get("location") || undefined,
  };
  const limit = parseInt(params.get("limit") || "10", 10);
  const users = await searchUsersByAttributes({ base, limit });
  return NextResponse.json(users);
}
