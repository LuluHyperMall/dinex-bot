import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { OrderStatus, StaffCallStatus, PaymentStatus, PaymentMethod } from "./enums";
import { minutesSince } from "./utils";

export type Urgency = "normal" | "warning" | "urgent" | "critical";

export function urgencyFor(minutes: number, s: { urgencyWarningMin: number; urgencyUrgentMin: number; urgencyCriticalMin: number }): Urgency {
  if (minutes >= s.urgencyCriticalMin) return "critical";
  if (minutes >= s.urgencyUrgentMin) return "urgent";
  if (minutes >= s.urgencyWarningMin) return "warning";
  return "normal";
}

/** Full kitchen board: orders by column, stats, staff calls, pending cash. */
export async function getKitchenBoard() {
  const settings = await getSettings();
  const orders = await prisma.order.findMany({
    where: { confirmed: true, status: { not: OrderStatus.CANCELLED } },
    include: { items: true, session: true },
    orderBy: { createdAt: "asc" },
  });

  const serialized = orders.map((o) => {
    const elapsed = minutesSince(o.createdAt);
    return {
      id: o.id,
      sessionId: o.sessionId,
      tableNumber: o.tableNumber,
      status: o.status,
      etaMinutes: o.etaMinutes,
      kitchenNote: o.kitchenNote,
      specialNote: o.specialNote,
      createdAt: o.createdAt,
      elapsedMinutes: elapsed,
      urgency: urgencyFor(elapsed, settings),
      estPrepTime: Math.max(...o.items.map((i) => 0), 0),
      items: o.items.map((i) => ({
        id: i.id,
        name: i.nameEn,
        nameHi: i.nameHi,
        emoji: i.emoji,
        qty: i.quantity,
        isVeg: i.isVeg,
        isCombo: i.isCombo,
        status: i.status,
        specialInstructions: i.specialInstructions,
      })),
    };
  });

  const byStatus = (st: string) => serialized.filter((o) => o.status === st);

  // served-today count
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const servedToday = await prisma.order.count({
    where: { status: OrderStatus.SERVED, servedAt: { gte: startOfDay } },
  });

  // average prep time (cooking->ready) over served/ready orders today
  const done = await prisma.order.findMany({
    where: { cookingAt: { not: null }, readyAt: { not: null }, createdAt: { gte: startOfDay } },
    select: { cookingAt: true, readyAt: true },
  });
  const avgPrep =
    done.length > 0
      ? Math.round(
          done.reduce((s, o) => s + (o.readyAt!.getTime() - o.cookingAt!.getTime()) / 60000, 0) / done.length
        )
      : 0;

  // most active item right now (in NEW/COOKING)
  const activeItems = serialized
    .filter((o) => o.status === OrderStatus.NEW || o.status === OrderStatus.COOKING)
    .flatMap((o) => o.items);
  const counts = new Map<string, number>();
  for (const it of activeItems) counts.set(it.name, (counts.get(it.name) || 0) + it.qty);
  const mostActive = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const staffCalls = await prisma.staffCall.findMany({
    where: { status: { in: [StaffCallStatus.PENDING, StaffCallStatus.ACKNOWLEDGED] } },
    orderBy: { createdAt: "asc" },
  });

  const pendingCash = await prisma.payment.findMany({
    where: { method: PaymentMethod.CASH, status: PaymentStatus.PENDING },
    orderBy: { createdAt: "asc" },
  });

  return {
    settings: {
      urgencyWarningMin: settings.urgencyWarningMin,
      urgencyUrgentMin: settings.urgencyUrgentMin,
      urgencyCriticalMin: settings.urgencyCriticalMin,
      restaurantName: settings.restaurantName,
    },
    columns: {
      new: byStatus(OrderStatus.NEW),
      cooking: byStatus(OrderStatus.COOKING),
      ready: byStatus(OrderStatus.READY),
      served: byStatus(OrderStatus.SERVED),
    },
    stats: {
      pending: byStatus(OrderStatus.NEW).length,
      cooking: byStatus(OrderStatus.COOKING).length,
      ready: byStatus(OrderStatus.READY).length,
      servedToday,
      avgPrep,
      mostActive,
    },
    staffCalls,
    pendingCash,
  };
}
