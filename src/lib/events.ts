// Canonical Socket.IO event names (PRD section 9) + room helpers.

export const EVENTS = {
  SESSION_STARTED: "session.started",
  SESSION_UPDATED: "session.updated",
  SCREEN_MODE_CHANGED: "screen.mode.changed",
  DISHES_SHOW: "dishes.show",
  COMBOS_SHOW: "combos.show",
  ORDER_UPDATED: "order.updated",
  ORDER_CONFIRMED: "order.confirmed",
  ORDER_SENT_TO_KITCHEN: "order.sent_to_kitchen",
  KITCHEN_ORDER_NEW: "kitchen.order.new",
  KITCHEN_ORDER_COOKING: "kitchen.order.cooking",
  KITCHEN_ORDER_ETA: "kitchen.order.eta",
  KITCHEN_ORDER_READY: "kitchen.order.ready",
  KITCHEN_ORDER_SERVED: "kitchen.order.served",
  KITCHEN_ORDER_CANCELLED: "kitchen.order.cancelled",
  BILL_UPDATED: "bill.updated",
  PAYMENT_QR_SHOW: "payment.qr.show",
  PAYMENT_SUCCESS: "payment.success",
  TABLE_FREED: "table.freed",
  STAFF_CALLED: "staff.called",
  STAFF_RESOLVED: "staff.resolved",
  ADMIN_DASHBOARD_UPDATED: "admin.dashboard.updated",
  MENU_ITEM_UPDATED: "menu.item.updated",
  COMBO_UPDATED: "combo.updated",
  // internal extras (beyond the PRD list)
  KITCHEN_ORDER_DELAYED: "kitchen.order.delayed",
  KITCHEN_ITEM_UNAVAILABLE: "kitchen.item.unavailable",
  PAYMENT_CASH_REQUESTED: "payment.cash.requested",
  KITCHEN_REFRESH: "kitchen.refresh",
  ADMIN_MESSAGE: "admin.message",
  SESSION_ENDED: "session.ended",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

// Rooms: every client joins by role; table clients also join their table room.
export const ROOMS = {
  KITCHEN: "kitchen",
  ADMIN: "admin",
  table: (tableNumber: number | string) => `table:${tableNumber}`,
};
