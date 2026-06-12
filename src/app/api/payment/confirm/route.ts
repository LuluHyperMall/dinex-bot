import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeBill } from "@/lib/billing";
import { closeSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { recordSessionRevenue } from "@/lib/analytics";
import { sendBillEmail } from "@/lib/email";
import { emit, emitAll, EVENTS } from "@/lib/realtime";
import { PaymentStatus, PaymentMethod, SessionStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { sessionId, method = PaymentMethod.UPI, email } = await req.json();
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const session = await prisma.tableSession.findUnique({ where: { id: sessionId }, include: { orders: true } });
    if (!session) return NextResponse.json({ error: "session_not_found" }, { status: 404 });

    const bill = await recomputeBill(sessionId);

    const payment = await prisma.payment.create({
      data: {
        sessionId,
        tableNumber: session.tableNumber,
        method,
        status: PaymentStatus.SUCCESS,
        amount: bill.total,
        reference: `DX${Date.now().toString().slice(-8)}`,
        paidAt: new Date(),
      },
    });

    // NOTE: we do NOT close the session here — the table stays the guest's until
    // Raj confirms "session end" with them (endSession tool). This keeps their
    // order on-screen while they finish eating.
    await recordSessionRevenue(bill.total, session.orders.filter((o) => o.confirmed).length);
    await logActivity("payment.done", `Table ${session.tableNumber} paid ${bill.currencySymbol}${Math.round(bill.total)} via ${method}`, {
      tableNumber: session.tableNumber,
      sessionId,
    });

    emit({ table: session.tableNumber }, EVENTS.PAYMENT_SUCCESS, { sessionId, payment });
    emitAll(EVENTS.SESSION_UPDATED, { sessionId, status: SessionStatus.BILLING }, session.tableNumber);

    // fire-and-forget bill email
    if (email) {
      sendBillEmail({
        to: email,
        tableNumber: session.tableNumber,
        sessionTime: new Date(session.startedAt).toLocaleString("en-IN"),
        lines: bill.lines,
        subtotal: bill.subtotal,
        gstAmount: bill.gstAmount,
        serviceAmount: bill.serviceAmount,
        total: bill.total,
        method,
        paidAt: new Date().toLocaleString("en-IN"),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, payment, bill });
  } catch (e: any) {
    console.error("[payment/confirm]", e?.message);
    return NextResponse.json({ error: "payment_failed", message: e?.message }, { status: 500 });
  }
}
