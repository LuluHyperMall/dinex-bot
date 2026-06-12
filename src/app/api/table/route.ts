import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getOrCreateSession, closeSession, getSessionState } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { emitAll, pokeAdmin, EVENTS } from "@/lib/realtime";
import { SessionStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (sessionId) {
    const state = await getSessionState(sessionId);
    return NextResponse.json({ state });
  }
  return NextResponse.json({ error: "sessionId required" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { action, tableNumber, sessionId, toTable } = await req.json();

  if (action === "start") {
    const { session } = await getOrCreateSession(Number(tableNumber));
    emitAll(EVENTS.SESSION_STARTED, { session }, session.tableNumber);
    pokeAdmin();
    return NextResponse.json({ ok: true, session });
  }

  if (action === "close" || action === "free") {
    if (!sessionId) {
      // free by table: close its active session
      const s = await prisma.tableSession.findFirst({
        where: { tableNumber: Number(tableNumber), status: { notIn: [SessionStatus.PAID, SessionStatus.INCOMPLETE] } },
        orderBy: { startedAt: "desc" },
      });
      if (s) await closeSession(s.id, SessionStatus.INCOMPLETE);
      emitAll(EVENTS.TABLE_FREED, { tableNumber: Number(tableNumber) }, Number(tableNumber));
      pokeAdmin();
      return NextResponse.json({ ok: true });
    }
    const s = await closeSession(sessionId, SessionStatus.INCOMPLETE);
    emitAll(EVENTS.TABLE_FREED, { tableNumber: s.tableNumber }, s.tableNumber);
    pokeAdmin();
    return NextResponse.json({ ok: true });
  }

  if (action === "move") {
    const s = await prisma.tableSession.findUnique({ where: { id: sessionId } });
    if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });
    await prisma.tableSession.update({ where: { id: sessionId }, data: { tableNumber: Number(toTable) } });
    await prisma.order.updateMany({ where: { sessionId }, data: { tableNumber: Number(toTable) } });
    await logActivity("session.started", `Session moved Table ${s.tableNumber} → ${toTable}`, { tableNumber: Number(toTable), sessionId });
    pokeAdmin();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
