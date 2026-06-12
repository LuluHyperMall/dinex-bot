// Typed unions backing the String status fields in the Prisma schema.

export const SessionStatus = {
  ACTIVE: "ACTIVE",
  ORDERED: "ORDERED",
  COOKING: "COOKING",
  READY: "READY",
  BILLING: "BILLING",
  PAID: "PAID",
  INCOMPLETE: "INCOMPLETE",
} as const;
export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

// Table-level status (FREE means no active session on that table)
export const TableStatus = {
  FREE: "FREE",
  ...SessionStatus,
} as const;
export type TableStatus = "FREE" | SessionStatus;

export const OrderStatus = {
  NEW: "NEW",
  COOKING: "COOKING",
  READY: "READY",
  SERVED: "SERVED",
  CANCELLED: "CANCELLED",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const PaymentStatus = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  UPI: "UPI",
  CARD: "CARD",
  CASH: "CASH",
  WALLET: "WALLET",
} as const;
export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

export const StaffCallStatus = {
  PENDING: "PENDING",
  ACKNOWLEDGED: "ACKNOWLEDGED",
  RESOLVED: "RESOLVED",
} as const;
export type StaffCallStatus = (typeof StaffCallStatus)[keyof typeof StaffCallStatus];

// Screen modes the bot can switch to (driven by AI + realtime events)
export const ScreenMode = {
  IDLE: "idle",
  DISHES: "dishes",
  COMBOS: "combos",
  ORDER: "order",
  KITCHEN: "kitchen",
  BILLING: "billing",
  PAYMENT: "payment",
  STAFF: "staff",
} as const;
export type ScreenMode = (typeof ScreenMode)[keyof typeof ScreenMode];
