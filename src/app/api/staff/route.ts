import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { emit, emitAll, pokeAdmin, EVENTS } from "@/lib/realtime";
import { StaffCallStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

export async function GET() {
  const calls = await prisma.staffCall.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ calls });
}

export async function POST(req: NextRequest) {
  const { callId, action } = await req.json();
  const call = await prisma.staffCall.findUnique({ where: { id: callId } });
  if (!call) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (action === "ack") {
    await prisma.staffCall.update({ where: { id: callId }, data: { status: StaffCallStatus.ACKNOWLEDGED } });
  } else if (action === "resolve") {
    await prisma.staffCall.update({ where: { id: callId }, data: { status: StaffCallStatus.RESOLVED, resolvedAt: new Date() } });
    emit({ table: call.tableNumber }, EVENTS.STAFF_RESOLVED, { callId, tableNumber: call.tableNumber });
    await logActivity("staff.resolved", `Table ${call.tableNumber} staff call resolved`, { tableNumber: call.tableNumber });
  }
  emitAll(EVENTS.STAFF_CALLED, { call: { ...call, status: action === "ack" ? "ACKNOWLEDGED" : "RESOLVED" } }, call.tableNumber);
  pokeAdmin();
  return NextResponse.json({ ok: true });
}
