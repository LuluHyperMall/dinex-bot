import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeBill } from "@/lib/billing";
import { closeSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { recordSessionRevenue } from "@/lib/analytics";
import { emit, emitAll, pokeAdmin, EVENTS } from "@/lib/realtime";
import { PaymentStatus, PaymentMethod, SessionStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { action, sessionId, paymentId } = await req.json();

  if (action === "request") {
    const session = await prisma.tableSession.findUnique({ where: { id: sessionId } });
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
    const bill = await recomputeBill(sessionId);
    const payment = await prisma.payment.create({
      data: {
        sessionId,
        tableNumber: session.tableNumber,
        method: PaymentMethod.CASH,
        status: PaymentStatus.PENDING,
        amount: bill.total,
        reference: `CASH${Date.now().toString().slice(-6)}`,
      },
    });
    await prisma.tableSession.update({ where: { id: sessionId }, data: { status: SessionStatus.BILLING } });
    emitAll(EVENTS.PAYMENT_CASH_REQUESTED, { payment, tableNumber: session.tableNumber }, session.tableNumber);
    emit({ kitchen: true }, EVENTS.KITCHEN_REFRESH, { at: Date.now() });
    await logActivity("payment.done", `Table ${session.tableNumber} requested CASH payment ₹${Math.round(bill.total)}`, {
      tableNumber: session.tableNumber,
      sessionId,
    });
    pokeAdmin();
    return NextResponse.json({ ok: true, paymentId: payment.id, amount: bill.total });
  }

  if (action === "confirm") {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return NextResponse.json({ error: "payment_not_found" }, { status: 404 });
    await prisma.payment.update({ where: { id: paymentId }, data: { status: PaymentStatus.SUCCESS, paidAt: new Date() } });
    const session = await prisma.tableSession.findUnique({ where: { id: payment.sessionId }, include: { orders: true } });
    if (session) await recordSessionRevenue(payment.amount, session.orders.filter((o) => o.confirmed).length);
    // session stays open until the guest confirms "end session" (endSession tool)
    emit({ table: payment.tableNumber }, EVENTS.PAYMENT_SUCCESS, { sessionId: payment.sessionId, payment });
    emit({ kitchen: true }, EVENTS.KITCHEN_REFRESH, { at: Date.now() });
    await logActivity("payment.done", `Table ${payment.tableNumber} CASH confirmed ₹${Math.round(payment.amount)}`, {
      tableNumber: payment.tableNumber,
      sessionId: payment.sessionId,
    });
    pokeAdmin();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
