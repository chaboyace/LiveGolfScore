import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;

  const apiKey = process.env.GOLFCOURSE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Course lookup is not configured." }, { status: 500 });
  }

  const res = await fetch(`https://api.golfcourseapi.com/v1/courses/${id}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Course lookup failed." }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
