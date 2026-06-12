import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Lightweight health endpoint for the keep-alive pinger (no DB work).
export async function GET() {
  return NextResponse.json({ ok: true, service: "dinex-bot", t: Date.now() });
}
