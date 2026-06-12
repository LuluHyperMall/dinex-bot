import { NextRequest, NextResponse } from "next/server";
import { emit, EVENTS } from "@/lib/realtime";

export const dynamic = "force-dynamic";

// Push a message to a table's bot screen (Raj will say it).
export async function POST(req: NextRequest) {
  const { tableNumber, message } = await req.json();
  if (!tableNumber || !message) return NextResponse.json({ error: "tableNumber & message required" }, { status: 400 });
  emit({ table: Number(tableNumber) }, EVENTS.ADMIN_MESSAGE, { message });
  return NextResponse.json({ ok: true });
}
