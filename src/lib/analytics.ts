import { prisma } from "./prisma";
import { todayKey } from "./utils";

/** Roll a completed session's totals into the day's analytics row. */
export async function recordSessionRevenue(amount: number, orderCount: number) {
  const date = todayKey();
  const existing = await prisma.dailyAnalytics.findUnique({ where: { date } });
  if (!existing) {
    return prisma.dailyAnalytics.create({
      data: { date, revenue: amount, orders: orderCount, sessions: 1, avgOrderValue: amount },
    });
  }
  const sessions = existing.sessions + 1;
  const revenue = existing.revenue + amount;
  return prisma.dailyAnalytics.update({
    where: { date },
    data: {
      revenue,
      orders: existing.orders + orderCount,
      sessions,
      avgOrderValue: revenue / sessions,
    },
  });
}

/** Last N days of analytics rows (oldest first), filling gaps with zeroes. */
export async function lastNDays(n = 7) {
  const rows = await prisma.dailyAnalytics.findMany({ orderBy: { date: "desc" }, take: n });
  const map = new Map(rows.map((r) => [r.date, r]));
  const out: { date: string; revenue: number; orders: number; sessions: number; avgOrderValue: number }[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = todayKey(d);
    const r = map.get(key);
    out.push({
      date: key,
      revenue: r?.revenue ?? 0,
      orders: r?.orders ?? 0,
      sessions: r?.sessions ?? 0,
      avgOrderValue: r?.avgOrderValue ?? 0,
    });
  }
  return out;
}
