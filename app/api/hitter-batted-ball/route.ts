import { NextResponse } from "next/server";
import snapshot from "../../../data/fangraphs-batted-ball-2026.json";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    season: snapshot.season,
    minPA: snapshot.minPA,
    fetchedAt: snapshot.fetchedAt,
    source: "FanGraphs member export",
    fanGraphsUrl: snapshot.sourceUrl,
    rows: snapshot.rows,
  }, {
    headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
  });
}
