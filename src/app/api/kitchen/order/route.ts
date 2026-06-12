import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recomputeBill } from "@/lib/billing";
import { logActivity } from "@/lib/activity";
import { emit, emitAll, pokeAdmin, EVENTS } from "@/lib/realtime";
import { OrderStatus, SessionStatus } from "@/lib/enums";

export const dynamic = "force-dynamic";

async function kitchenUpdate(orderId: string, type: string, message = "") {
  await prisma.kitchenUpdate.create({ data: { orderId, type, message } });
}

export async function POST(req: NextRequest) {
  try {
    const { orderId, action, etaMinutes, note, itemId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    const table = order.tableNumber;

    switch (action) {
      case "start_cooking": {
        await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.COOKING, cookingAt: new Date() } });
        await prisma.orderItem.updateMany({ where: { orderId }, data: { status: OrderStatus.COOKING } });
        await prisma.tableSession.update({ where: { id: order.sessionId }, data: { status: SessionStatus.COOKING } });
        await kitchenUpdate(orderId, "cooking_started", "Cooking started");
        emitAll(EVENTS.KITCHEN_ORDER_COOKING, { orderId, tableNumber: table }, table);
        await logActivity("kitchen.update", `Table ${table}: cooking started`, { tableNumber: table, sessionId: order.sessionId });
        break;
      }
      case "set_eta": {
        const eta = Math.max(1, Number(etaMinutes) || 10);
        await prisma.order.update({ where: { id: orderId }, data: { etaMinutes: eta } });
        await kitchenUpdate(orderId, "eta_set", `ETA ${eta} min`);
        emitAll(EVENTS.KITCHEN_ORDER_ETA, { orderId, tableNumber: table, etaMinutes: eta }, table);
        await logActivity("kitchen.update", `Table ${table}: ETA set ${eta} min`, { tableNumber: table, sessionId: order.sessionId });
        break;
      }
      case "ready": {
        await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.READY, readyAt: new Date() } });
        await prisma.orderItem.updateMany({ where: { orderId }, data: { status: OrderStatus.READY } });
        await prisma.tableSession.update({ where: { id: order.sessionId }, data: { status: SessionStatus.READY } });
        await kitchenUpdate(orderId, "ready", "Food ready");
        emitAll(EVENTS.KITCHEN_ORDER_READY, { orderId, tableNumber: table }, table);
        await logActivity("kitchen.update", `Table ${table}: order ready`, { tableNumber: table, sessionId: order.sessionId });
        break;
      }
      case "served": {
        await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.SERVED, servedAt: new Date() } });
        await prisma.orderItem.updateMany({ where: { orderId }, data: { status: OrderStatus.SERVED } });
        await kitchenUpdate(orderId, "served", "Food served");
        emitAll(EVENTS.KITCHEN_ORDER_SERVED, { orderId, tableNumber: table }, table);
        await logActivity("kitchen.update", `Table ${table}: order served`, { tableNumber: table, sessionId: order.sessionId });
        break;
      }
      case "delayed": {
        await kitchenUpdate(orderId, "delayed", note || "Order delayed");
        emitAll(EVENTS.KITCHEN_ORDER_DELAYED, { orderId, tableNumber: table, message: note || "Thodi der lagegi" }, table);
        await logActivity("kitchen.update", `Table ${table}: order delayed`, { tableNumber: table, sessionId: order.sessionId });
        break;
      }
      case "add_note": {
        await prisma.order.update({ where: { id: orderId }, data: { kitchenNote: note || "" } });
        await kitchenUpdate(orderId, "note", note || "");
        break;
      }
      case "cancel_item": {
        if (itemId) {
          await prisma.orderItem.update({ where: { id: itemId }, data: { status: OrderStatus.CANCELLED } });
          const remaining = await prisma.orderItem.count({ where: { orderId, status: { not: OrderStatus.CANCELLED } } });
          if (remaining === 0) await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
          const bill = await recomputeBill(order.sessionId);
          emit({ table }, EVENTS.BILL_UPDATED, { sessionId: order.sessionId, bill });
          emit({ table }, EVENTS.ORDER_UPDATED, { sessionId: order.sessionId });
        }
        break;
      }
      case "cancel_order": {
        await prisma.order.update({ where: { id: orderId }, data: { status: OrderStatus.CANCELLED } });
        await prisma.orderItem.updateMany({ where: { orderId }, data: { status: OrderStatus.CANCELLED } });
        await kitchenUpdate(orderId, "cancelled", note || "Order cancelled");
        const bill = await recomputeBill(order.sessionId);
        emitAll(EVENTS.KITCHEN_ORDER_CANCELLED, { orderId, tableNumber: table }, table);
        emit({ table }, EVENTS.BILL_UPDATED, { sessionId: order.sessionId, bill });
        await logActivity("kitchen.update", `Table ${table}: order cancelled`, { tableNumber: table, sessionId: order.sessionId });
        break;
      }
      default:
        return NextResponse.json({ error: "unknown_action" }, { status: 400 });
    }

    emit({ kitchen: true }, EVENTS.KITCHEN_REFRESH, { at: Date.now() });
    pokeAdmin();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[kitchen/order]", e?.message);
    return NextResponse.json({ error: "failed", message: e?.message }, { status: 500 });
  }
}
