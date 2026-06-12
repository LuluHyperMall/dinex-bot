import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSession, getSessionState } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

// POST { tableNumber } -> get-or-create the open session + initial state
export async function POST(req: NextRequest) {
  const { tableNumber } = await req.json();
  const n = Number(tableNumber);
  if (!n) return NextResponse.json({ error: "tableNumber required" }, { status: 400 });
  const { session, created } = await getOrCreateSession(n);
  const state = await getSessionState(session.id);
  const settings = await getSettings();
  return NextResponse.json({
    sessionId: session.id,
    created,
    state,
    settings: {
      restaurantName: settings.restaurantName,
      aiWaiterName: settings.aiWaiterName,
      currencySymbol: settings.currencySymbol,
      gstPercent: settings.gstPercent,
      serviceChargePercent: settings.serviceChargePercent,
    },
  });
}

// GET ?sessionId= -> latest state
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  const state = await getSessionState(sessionId);
  if (!state) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ state });
}
