import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { OrderStatus } from "./enums";

export type Bill = {
  subtotal: number;
  gstAmount: number;
  serviceAmount: number;
  total: number;
  gstPercent: number;
  serviceChargePercent: number;
  currencySymbol: string;
  lines: { name: string; emoji: string; qty: number; unitPrice: number; lineTotal: number; isVeg: boolean }[];
};

/**
 * Recompute a session's bill from all of its non-cancelled order items,
 * persist the totals on the session, and return the structured bill.
 */
export async function recomputeBill(sessionId: string): Promise<Bill> {
  const settings = await getSettings();
  const orders = await prisma.order.findMany({
    where: { sessionId },
    include: { items: true },
  });

  const lineMap = new Map<string, Bill["lines"][number]>();
  let subtotal = 0;

  for (const order of orders) {
    for (const it of order.items) {
      if (it.status === OrderStatus.CANCELLED) continue;
      const lineTotal = it.unitPrice * it.quantity;
      subtotal += lineTotal;
      const key = `${it.nameEn}|${it.unitPrice}`;
      const existing = lineMap.get(key);
      if (existing) {
        existing.qty += it.quantity;
        existing.lineTotal += lineTotal;
      } else {
        lineMap.set(key, {
          name: it.nameEn,
          emoji: it.emoji,
          qty: it.quantity,
          unitPrice: it.unitPrice,
          lineTotal,
          isVeg: it.isVeg,
        });
      }
    }
  }

  const gstAmount = round2((subtotal * settings.gstPercent) / 100);
  const serviceAmount = round2((subtotal * settings.serviceChargePercent) / 100);
  const total = round2(subtotal + gstAmount + serviceAmount);

  await prisma.tableSession.update({
    where: { id: sessionId },
    data: { subtotal, gstAmount, serviceAmount, total, lastActivity: new Date() },
  });

  return {
    subtotal: round2(subtotal),
    gstAmount,
    serviceAmount,
    total,
    gstPercent: settings.gstPercent,
    serviceChargePercent: settings.serviceChargePercent,
    currencySymbol: settings.currencySymbol,
    lines: Array.from(lineMap.values()),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
