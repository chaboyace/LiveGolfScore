import { NextResponse } from "next/server";

export async function GET(request) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query || query.trim().length < 3) {
    return NextResponse.json({ error: "Search term too short." }, { status: 400 });
  }

  const apiKey = process.env.GOLFCOURSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Course search is not configured." }, { status: 500 });
  }

  const res = await fetch(
    `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query.trim())}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "Course search failed." }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
