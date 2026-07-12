export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import ytdl from "ytdl-core";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  process.env.YTDL_NO_UPDATE = "1";
  try {
    const info = await ytdl.getInfo(url, {
      requestOptions: { family: 4 },
    });
    const format = ytdl.chooseFormat(info.formats, { quality: "highestaudio" });
    return NextResponse.json({ audioUrl: format.url, title: info.videoDetails.title });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
