import { prisma } from "./prisma";
import { pokeAdmin } from "./realtime";

export type ActivityType =
  | "order.new"
  | "order.confirmed"
  | "kitchen.update"
  | "payment.done"
  | "staff.call"
  | "staff.resolved"
  | "item.disabled"
  | "item.updated"
  | "combo.updated"
  | "session.started"
  | "session.closed";

/** Persist an activity-feed entry and nudge admin dashboards to refresh. */
export async function logActivity(
  type: ActivityType,
  message: string,
  opts: { tableNumber?: number; sessionId?: string } = {}
) {
  const entry = await prisma.activityLog.create({
    data: {
      type,
      message,
      tableNumber: opts.tableNumber ?? null,
      sessionId: opts.sessionId ?? null,
    },
  });
  pokeAdmin();
  return entry;
}
