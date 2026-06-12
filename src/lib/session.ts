import { prisma } from "./prisma";
import { SessionStatus, OrderStatus } from "./enums";
import { recomputeBill } from "./billing";
import { logActivity } from "./activity";

const ACTIVE_STATUSES = [
  SessionStatus.ACTIVE,
  SessionStatus.ORDERED,
  SessionStatus.COOKING,
  SessionStatus.READY,
  SessionStatus.BILLING,
];

/** Find the current open session for a table (any non-final status). */
export async function findActiveSession(tableNumber: number) {
  return prisma.tableSession.findFirst({
    where: { tableNumber, status: { in: ACTIVE_STATUSES } },
    orderBy: { startedAt: "desc" },
  });
}

/** Get-or-create the open session for a table. */
export async function getOrCreateSession(tableNumber: number) {
  const existing = await findActiveSession(tableNumber);
  if (existing) return { session: existing, created: false };
  const session = await prisma.tableSession.create({
    data: { tableNumber, status: SessionStatus.ACTIVE },
  });
  await logActivity("session.started", `Table ${tableNumber} session started`, {
    tableNumber,
    sessionId: session.id,
  });
  return { session, created: true };
}

/** Full serialized state used by the bot screen + admin session view. */
export async function getSessionState(sessionId: string) {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      orders: {
        orderBy: { createdAt: "asc" },
        include: { items: true, kitchenUpdates: { orderBy: { createdAt: "asc" } } },
      },
      payments: { orderBy: { createdAt: "desc" } },
      staffCalls: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!session) return null;
  const bill = await recomputeBill(sessionId);

  // Flatten current (non-cancelled) order items for an at-a-glance order summary.
  const orderItems = session.orders.flatMap((o) =>
    o.items
      .filter((i) => i.status !== OrderStatus.CANCELLED)
      .map((i) => ({
        id: i.id,
        orderId: o.id,
        name: i.nameEn,
        nameHi: i.nameHi,
        emoji: i.emoji,
        qty: i.quantity,
        unitPrice: i.unitPrice,
        isVeg: i.isVeg,
        isCombo: i.isCombo,
        status: i.status,
        orderStatus: o.status,
        confirmed: o.confirmed,
        specialInstructions: i.specialInstructions,
        etaMinutes: o.etaMinutes,
      }))
  );

  return { session, bill, orderItems };
}

/** Mark a session paid + free the table. */
export async function closeSession(sessionId: string, status: string = SessionStatus.PAID) {
  const session = await prisma.tableSession.update({
    where: { id: sessionId },
    data: { status, endedAt: new Date() },
  });
  await logActivity("session.closed", `Table ${session.tableNumber} session closed (${status})`, {
    tableNumber: session.tableNumber,
    sessionId: session.id,
  });
  return session;
}

/** Update preferences captured during conversation. */
export async function updatePreferences(
  sessionId: string,
  prefs: Partial<{ prefVeg: string; prefSpice: string; prefCuisine: string; partySize: number; allergies: string }>
) {
  return prisma.tableSession.update({
    where: { id: sessionId },
    data: { ...prefs, lastActivity: new Date() },
  });
}
