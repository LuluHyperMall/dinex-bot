import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { lastNDays } from "./analytics";
import { minutesSince, todayKey } from "./utils";
import { SessionStatus, OrderStatus, PaymentStatus } from "./enums";

const ACTIVE_STATUSES = [
  SessionStatus.ACTIVE,
  SessionStatus.ORDERED,
  SessionStatus.COOKING,
  SessionStatus.READY,
  SessionStatus.BILLING,
];

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Live table grid: one entry per configured table, status FREE if no session. */
export async function getTableGrid() {
  const settings = await getSettings();
  const sessions = await prisma.tableSession.findMany({
    where: { status: { in: ACTIVE_STATUSES } },
    include: { orders: { include: { items: true } } },
    orderBy: { startedAt: "desc" },
  });
  const byTable = new Map<number, (typeof sessions)[number]>();
  for (const s of sessions) if (!byTable.has(s.tableNumber)) byTable.set(s.tableNumber, s);

  const grid = [];
  for (let n = 1; n <= settings.numberOfTables; n++) {
    const s = byTable.get(n);
    grid.push({
      tableNumber: n,
      status: s?.status ?? "FREE",
      sessionId: s?.id ?? null,
      durationMin: s ? minutesSince(s.startedAt) : 0,
      bill: s?.total ?? 0,
      lastActivity: s?.lastActivity ?? null,
      itemCount: s ? s.orders.flatMap((o) => o.items).filter((i) => i.status !== OrderStatus.CANCELLED).length : 0,
    });
  }
  return grid;
}

export async function getDashboard() {
  const settings = await getSettings();
  const sod = startOfToday();

  const paymentsToday = await prisma.payment.findMany({ where: { status: PaymentStatus.SUCCESS, paidAt: { gte: sod } } });
  const revenue = paymentsToday.reduce((s, p) => s + p.amount, 0);

  const ordersToday = await prisma.order.count({ where: { confirmed: true, createdAt: { gte: sod } } });

  const grid = await getTableGrid();
  const activeTables = grid.filter((g) => g.status !== "FREE" && g.status !== SessionStatus.BILLING).length;
  const billingTables = grid.filter((g) => g.status === SessionStatus.BILLING).length;
  const freeTables = grid.filter((g) => g.status === "FREE").length;

  const pendingKitchen = await prisma.order.count({ where: { confirmed: true, status: { in: [OrderStatus.NEW, OrderStatus.COOKING] } } });

  const topItem = await prisma.menuItem.findFirst({ where: { todayDate: todayKey() }, orderBy: { todayOrders: "desc" } });

  const activity = await prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 });

  return {
    cards: {
      revenue,
      orders: ordersToday,
      activeTables,
      billingTables,
      freeTables,
      avgOrderValue: paymentsToday.length ? revenue / paymentsToday.length : 0,
      mostOrdered: topItem?.nameEn ?? "—",
      pendingKitchen,
      paymentsToday: paymentsToday.length,
      currencySymbol: settings.currencySymbol,
    },
    grid,
    activity,
  };
}

export async function getLiveOrders() {
  const orders = await prisma.order.findMany({
    where: { confirmed: true, status: { in: [OrderStatus.NEW, OrderStatus.COOKING, OrderStatus.READY] } },
    include: { items: true, session: true },
    orderBy: { createdAt: "desc" },
  });
  return orders.map((o) => ({
    id: o.id,
    tableNumber: o.tableNumber,
    status: o.status,
    etaMinutes: o.etaMinutes,
    specialNote: o.specialNote,
    kitchenNote: o.kitchenNote,
    elapsedMinutes: minutesSince(o.createdAt),
    sessionStatus: o.session.status,
    items: o.items.map((i) => ({ id: i.id, name: i.nameEn, qty: i.quantity, isVeg: i.isVeg, status: i.status, specialInstructions: i.specialInstructions })),
  }));
}

export async function getBilling() {
  const settings = await getSettings();
  const active = await prisma.tableSession.findMany({
    where: { status: { in: [SessionStatus.BILLING, ...ACTIVE_STATUSES] } },
    orderBy: { lastActivity: "desc" },
  });
  const payments = await prisma.payment.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  const breakdown: Record<string, { count: number; amount: number }> = {};
  for (const p of payments) {
    if (p.status !== PaymentStatus.SUCCESS) continue;
    breakdown[p.method] = breakdown[p.method] || { count: 0, amount: 0 };
    breakdown[p.method].count++;
    breakdown[p.method].amount += p.amount;
  }

  return {
    currencySymbol: settings.currencySymbol,
    activeBills: active
      .filter((s) => s.total > 0)
      .map((s) => ({ sessionId: s.id, tableNumber: s.tableNumber, total: s.total, status: s.status })),
    payments,
    breakdown,
  };
}

export async function getHistory(filters: { date?: string; table?: number; method?: string; q?: string } = {}) {
  const where: any = { status: SessionStatus.PAID };
  if (filters.table) where.tableNumber = filters.table;
  const sessions = await prisma.tableSession.findMany({
    where,
    include: { orders: { include: { items: true } }, payments: true },
    orderBy: { endedAt: "desc" },
    take: 200,
  });

  let rows = sessions.map((s) => {
    const items = s.orders.flatMap((o) => o.items).filter((i) => i.status !== OrderStatus.CANCELLED);
    const payment = s.payments.find((p) => p.status === PaymentStatus.SUCCESS) || s.payments[0];
    return {
      sessionId: s.id,
      tableNumber: s.tableNumber,
      startTime: s.startedAt,
      endTime: s.endedAt,
      durationMin: s.endedAt ? Math.round((new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000) : 0,
      items: items.map((i) => `${i.quantity}× ${i.nameEn}`),
      itemNotes: items.map((i) => i.specialInstructions).filter(Boolean).join("; "),
      subtotal: s.subtotal,
      gst: s.gstAmount,
      service: s.serviceAmount,
      total: s.total,
      method: payment?.method ?? "—",
      status: s.status,
    };
  });

  if (filters.date) rows = rows.filter((r) => r.endTime && todayKey(new Date(r.endTime)) === filters.date);
  if (filters.method) rows = rows.filter((r) => r.method === filters.method);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    rows = rows.filter((r) => r.items.join(" ").toLowerCase().includes(q) || r.itemNotes.toLowerCase().includes(q));
  }
  return rows;
}

export async function getAnalytics() {
  const settings = await getSettings();
  const days = await lastNDays(7);

  const items = await prisma.menuItem.findMany();
  const bestSelling = [...items].sort((a, b) => b.totalOrders - a.totalOrders).slice(0, 8);
  const slowMoving = [...items].sort((a, b) => a.totalOrders - b.totalOrders).slice(0, 8);

  // cuisine + category performance (by totalOrders)
  const groupBy = (key: "cuisineType" | "category") => {
    const m = new Map<string, number>();
    for (const i of items) m.set(i[key], (m.get(i[key]) || 0) + i.totalOrders);
    return [...m.entries()].map(([name, orders]) => ({ name, orders })).sort((a, b) => b.orders - a.orders);
  };

  // payment method breakdown
  const payments = await prisma.payment.findMany({ where: { status: PaymentStatus.SUCCESS } });
  const methodMap = new Map<string, number>();
  for (const p of payments) methodMap.set(p.method, (methodMap.get(p.method) || 0) + 1);
  const paymentBreakdown = [...methodMap.entries()].map(([name, value]) => ({ name, value }));

  // peak hours (confirmed orders by hour)
  const orders = await prisma.order.findMany({ where: { confirmed: true }, select: { createdAt: true } });
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, orders: 0 }));
  for (const o of orders) hours[new Date(o.createdAt).getHours()].orders++;
  const peakHours = hours.filter((h) => h.orders > 0);

  // averages
  const paidSessions = await prisma.tableSession.findMany({ where: { status: SessionStatus.PAID, endedAt: { not: null } } });
  const avgSessionMin = paidSessions.length
    ? Math.round(paidSessions.reduce((s, x) => s + (new Date(x.endedAt!).getTime() - new Date(x.startedAt).getTime()) / 60000, 0) / paidSessions.length)
    : 0;
  const avgOrderValue = payments.length ? payments.reduce((s, p) => s + p.amount, 0) / payments.length : 0;

  const sod = startOfToday();
  const donePrep = await prisma.order.findMany({ where: { cookingAt: { not: null }, readyAt: { not: null } }, select: { cookingAt: true, readyAt: true } });
  const avgPrep = donePrep.length
    ? Math.round(donePrep.reduce((s, o) => s + (o.readyAt!.getTime() - o.cookingAt!.getTime()) / 60000, 0) / donePrep.length)
    : 0;

  return {
    currencySymbol: settings.currencySymbol,
    days,
    bestSelling: bestSelling.map((i) => ({ name: i.nameEn, orders: i.totalOrders, revenue: i.totalOrders * i.price, lastOrdered: i.updatedAt })),
    slowMoving: slowMoving.map((i) => ({ name: i.nameEn, orders: i.totalOrders })),
    cuisine: groupBy("cuisineType"),
    category: groupBy("category"),
    paymentBreakdown,
    peakHours,
    avgSessionMin,
    avgOrderValue,
    avgPrep,
    itemTable: items
      .map((i) => ({ name: i.nameEn, todayOrders: i.todayDate === todayKey() ? i.todayOrders : 0, totalOrders: i.totalOrders, revenue: i.totalOrders * i.price, lastOrdered: i.updatedAt }))
      .sort((a, b) => b.totalOrders - a.totalOrders),
  };
}
