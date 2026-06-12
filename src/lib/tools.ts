// Dinex AI server tools (PRD section 6).
// Every tool is a server-side function operating on the database and emitting
// realtime events. The GPT-4o endpoint (and the local fallback engine) call
// these — Raj never invents menu data, he always goes through here.

import { prisma } from "./prisma";
import { getSettings } from "./settings";
import { recomputeBill } from "./billing";
import { getOrCreateSession, getSessionState, updatePreferences, closeSession } from "./session";
import { logActivity } from "./activity";
import { emit, emitAll, EVENTS } from "./realtime";
import { SessionStatus, OrderStatus, StaffCallStatus, ScreenMode } from "./enums";
import { todayKey } from "./utils";
import QRCode from "qrcode";

export type ToolContext = { tableNumber: number; sessionId: string };

// ---------- helpers ----------

function publicItem(i: any) {
  return {
    id: i.id,
    name: i.nameEn,
    nameHi: i.nameHi,
    emoji: i.emoji,
    price: i.price,
    isVeg: i.isVeg,
    category: i.category,
    cuisine: i.cuisineType,
    description: i.description,
    spiceLevel: i.spiceLevel,
    prepTime: i.prepTimeMinutes,
    photoUrl: i.photoUrl,
    bestseller: i.bestseller,
    recommended: i.recommended,
    available: i.available && !i.outOfStock,
    totalOrders: i.totalOrders,
    tags: i.tags ? i.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
  };
}

function publicCombo(c: any) {
  return {
    id: c.id,
    name: c.nameEn,
    nameHi: c.nameHi,
    emoji: c.emoji,
    description: c.description,
    originalPrice: c.originalPrice,
    comboPrice: c.comboPrice,
    savings: c.savings,
    photoUrl: c.photoUrl,
    category: c.category,
    active: c.active,
    items: (c.items || []).map((ci: any) => ({
      name: ci.menuItem?.nameEn,
      emoji: ci.menuItem?.emoji,
      quantity: ci.quantity,
    })),
  };
}

function setScreen(ctx: ToolContext, mode: string, extra: Record<string, unknown> = {}) {
  emit({ table: ctx.tableNumber }, EVENTS.SCREEN_MODE_CHANGED, { mode, ...extra });
}

/** Latest unconfirmed (draft) order for the session, or create one. */
async function getDraftOrder(ctx: ToolContext) {
  const existing = await prisma.order.findFirst({
    where: { sessionId: ctx.sessionId, confirmed: false, status: OrderStatus.NEW },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  if (existing) return existing;
  return prisma.order.create({
    data: { sessionId: ctx.sessionId, tableNumber: ctx.tableNumber, status: OrderStatus.NEW, confirmed: false },
    include: { items: true },
  });
}

async function pushBillUpdate(ctx: ToolContext) {
  const bill = await recomputeBill(ctx.sessionId);
  emit({ table: ctx.tableNumber }, EVENTS.BILL_UPDATED, { sessionId: ctx.sessionId, bill });
  return bill;
}

async function pushOrderUpdate(ctx: ToolContext) {
  const state = await getSessionState(ctx.sessionId);
  emit({ table: ctx.tableNumber }, EVENTS.ORDER_UPDATED, {
    sessionId: ctx.sessionId,
    orderItems: state?.orderItems ?? [],
    bill: state?.bill,
  });
  return state;
}

async function resolveItem(opts: { itemId?: string; name?: string }) {
  if (opts.itemId) {
    const byId = await prisma.menuItem.findUnique({ where: { id: opts.itemId } });
    if (byId) return byId;
  }
  if (opts.name) {
    const q = opts.name.toLowerCase().trim();
    const all = await prisma.menuItem.findMany({ where: { available: true } });
    // exact, then startsWith, then contains on name/hindi/tags
    return (
      all.find((i) => i.nameEn.toLowerCase() === q || i.nameHi === opts.name) ||
      all.find((i) => i.nameEn.toLowerCase().startsWith(q)) ||
      all.find(
        (i) =>
          i.nameEn.toLowerCase().includes(q) ||
          i.nameHi.includes(opts.name as string) ||
          i.tags.toLowerCase().includes(q)
      ) ||
      null
    );
  }
  return null;
}

// ---------- READ tools ----------

export async function getMenuItems(args: { category?: string; cuisine?: string; vegOnly?: boolean; availableOnly?: boolean } = {}) {
  const where: any = {};
  if (args.category) where.category = args.category;
  if (args.cuisine) where.cuisineType = args.cuisine;
  if (args.vegOnly) where.isVeg = true;
  if (args.availableOnly !== false) where.available = true;
  const items = await prisma.menuItem.findMany({ where, orderBy: { totalOrders: "desc" } });
  return { count: items.length, items: items.map(publicItem) };
}

export async function searchMenuItems(args: { query: string; vegOnly?: boolean }) {
  const q = (args.query || "").toLowerCase().trim();
  const all = await prisma.menuItem.findMany({ where: { available: true } });
  const matched = all.filter((i) => {
    if (args.vegOnly && !i.isVeg) return false;
    return (
      i.nameEn.toLowerCase().includes(q) ||
      i.nameHi.includes(args.query) ||
      i.tags.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q) ||
      i.cuisineType.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q)
    );
  });
  return { count: matched.length, items: matched.map(publicItem) };
}

export async function getAvailableCombos() {
  const combos = await prisma.combo.findMany({
    where: { active: true },
    include: { items: { include: { menuItem: true } } },
    orderBy: { savings: "desc" },
  });
  return { count: combos.length, combos: combos.map(publicCombo) };
}

export async function getBestSellers(args: { limit?: number } = {}) {
  const items = await prisma.menuItem.findMany({
    where: { available: true },
    orderBy: { totalOrders: "desc" },
    take: args.limit ?? 5,
  });
  return { items: items.map(publicItem) };
}

export async function getSlowMovingItems(args: { limit?: number } = {}) {
  const items = await prisma.menuItem.findMany({
    where: { available: true },
    orderBy: { totalOrders: "asc" },
    take: args.limit ?? 5,
  });
  return { items: items.map(publicItem) };
}

// ---------- SHOW (screen) tools ----------

export async function showDishCards(ctx: ToolContext, args: { itemIds?: string[]; query?: string; title?: string }) {
  let items: any[] = [];
  if (args.itemIds?.length) {
    items = await prisma.menuItem.findMany({ where: { id: { in: args.itemIds } } });
    // preserve requested order
    items.sort((a, b) => args.itemIds!.indexOf(a.id) - args.itemIds!.indexOf(b.id));
  } else if (args.query) {
    const r = await searchMenuItems({ query: args.query });
    const ids = r.items.slice(0, 6).map((i) => i.id);
    items = await prisma.menuItem.findMany({ where: { id: { in: ids } } });
    items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  }
  const cards = items.map(publicItem);
  emit({ table: ctx.tableNumber }, EVENTS.DISHES_SHOW, { title: args.title ?? "", dishes: cards });
  setScreen(ctx, ScreenMode.DISHES, { title: args.title ?? "" });
  return { shown: cards.length, dishes: cards };
}

export async function showComboCards(ctx: ToolContext, args: { comboIds?: string[]; title?: string }) {
  const where: any = { active: true };
  if (args.comboIds?.length) where.id = { in: args.comboIds };
  const combos = await prisma.combo.findMany({ where, include: { items: { include: { menuItem: true } } } });
  const cards = combos.map(publicCombo);
  emit({ table: ctx.tableNumber }, EVENTS.COMBOS_SHOW, { title: args.title ?? "", combos: cards });
  setScreen(ctx, ScreenMode.COMBOS, { title: args.title ?? "" });
  return { shown: cards.length, combos: cards };
}

// ---------- ORDER mutation tools ----------

export async function addItemToOrder(
  ctx: ToolContext,
  args: { itemId?: string; name?: string; quantity?: number; specialInstructions?: string }
) {
  const item = await resolveItem(args);
  if (!item) return { ok: false, error: "ITEM_NOT_FOUND", message: `Couldn't find that item on the menu.` };
  if (!item.available || item.outOfStock)
    return { ok: false, error: "UNAVAILABLE", message: `${item.nameEn} is currently unavailable.` };

  const qty = Math.max(1, args.quantity ?? 1);
  const draft = await getDraftOrder(ctx);

  // merge with an existing identical line in the draft
  const existing = draft.items.find((i) => i.menuItemId === item.id && !i.isCombo && i.specialInstructions === (args.specialInstructions ?? ""));
  if (existing) {
    await prisma.orderItem.update({ where: { id: existing.id }, data: { quantity: existing.quantity + qty } });
  } else {
    await prisma.orderItem.create({
      data: {
        orderId: draft.id,
        menuItemId: item.id,
        nameEn: item.nameEn,
        nameHi: item.nameHi,
        emoji: item.emoji,
        isVeg: item.isVeg,
        unitPrice: item.price,
        quantity: qty,
        specialInstructions: args.specialInstructions ?? "",
      },
    });
  }

  setScreen(ctx, ScreenMode.ORDER);
  const state = await pushOrderUpdate(ctx);
  await pushBillUpdate(ctx);
  return {
    ok: true,
    added: { name: item.nameEn, quantity: qty, unitPrice: item.price },
    message: `Added ${qty} × ${item.nameEn} (₹${item.price} each).`,
    bill: state?.bill,
  };
}

export async function addComboToOrder(ctx: ToolContext, args: { comboId?: string; name?: string; quantity?: number }) {
  let combo = null as any;
  if (args.comboId) combo = await prisma.combo.findUnique({ where: { id: args.comboId }, include: { items: { include: { menuItem: true } } } });
  if (!combo && args.name) {
    const all = await prisma.combo.findMany({ where: { active: true }, include: { items: { include: { menuItem: true } } } });
    const q = args.name.toLowerCase();
    combo = all.find((c) => c.nameEn.toLowerCase().includes(q) || c.nameHi.includes(args.name as string)) || null;
  }
  if (!combo) return { ok: false, error: "COMBO_NOT_FOUND", message: "Couldn't find that combo." };

  const qty = Math.max(1, args.quantity ?? 1);
  const draft = await getDraftOrder(ctx);
  await prisma.orderItem.create({
    data: {
      orderId: draft.id,
      comboId: combo.id,
      nameEn: combo.nameEn,
      nameHi: combo.nameHi,
      emoji: combo.emoji,
      isVeg: combo.items.every((ci: any) => ci.menuItem?.isVeg),
      isCombo: true,
      unitPrice: combo.comboPrice,
      quantity: qty,
    },
  });

  setScreen(ctx, ScreenMode.ORDER);
  const state = await pushOrderUpdate(ctx);
  await pushBillUpdate(ctx);
  return {
    ok: true,
    added: { name: combo.nameEn, quantity: qty, unitPrice: combo.comboPrice, savings: combo.savings },
    message: `Wah, smart choice! ${qty} × ${combo.nameEn} combo add kiya — poore ₹${combo.savings * qty} ki bachat! 🎉`,
    bill: state?.bill,
  };
}

export async function removeItemFromOrder(ctx: ToolContext, args: { itemId?: string; name?: string }) {
  const state = await getSessionState(ctx.sessionId);
  if (!state) return { ok: false, error: "NO_SESSION" };
  let target = state.orderItems.find((i) => i.id === args.itemId);
  if (!target && args.name) {
    const q = args.name.toLowerCase();
    target = state.orderItems.find((i) => i.name.toLowerCase().includes(q));
  }
  if (!target) return { ok: false, error: "ITEM_NOT_IN_ORDER", message: "That item isn't in the order." };
  await prisma.orderItem.delete({ where: { id: target.id } });
  await pushOrderUpdate(ctx);
  await pushBillUpdate(ctx);
  return { ok: true, removed: target.name, message: `Removed ${target.name} from the order.` };
}

export async function updateItemQuantity(ctx: ToolContext, args: { itemId?: string; name?: string; quantity: number }) {
  const state = await getSessionState(ctx.sessionId);
  if (!state) return { ok: false, error: "NO_SESSION" };
  let target = state.orderItems.find((i) => i.id === args.itemId);
  if (!target && args.name) {
    const q = args.name.toLowerCase();
    target = state.orderItems.find((i) => i.name.toLowerCase().includes(q));
  }
  if (!target) return { ok: false, error: "ITEM_NOT_IN_ORDER", message: "That item isn't in the order." };
  if (args.quantity <= 0) {
    await prisma.orderItem.delete({ where: { id: target.id } });
  } else {
    await prisma.orderItem.update({ where: { id: target.id }, data: { quantity: args.quantity } });
  }
  await pushOrderUpdate(ctx);
  await pushBillUpdate(ctx);
  return { ok: true, item: target.name, quantity: args.quantity, message: `Updated ${target.name} to ${args.quantity}.` };
}

export async function getCurrentOrder(ctx: ToolContext) {
  const state = await getSessionState(ctx.sessionId);
  if (!state) return { items: [], bill: null };
  return {
    items: state.orderItems.map((i) => ({ id: i.id, name: i.name, qty: i.qty, unitPrice: i.unitPrice, confirmed: i.confirmed, status: i.orderStatus })),
    bill: state.bill,
  };
}

export async function getCurrentBill(ctx: ToolContext) {
  const bill = await recomputeBill(ctx.sessionId);
  return { bill };
}

// ---------- CONFIRM / KITCHEN dispatch ----------

async function dispatchDraftToKitchen(ctx: ToolContext, specialNote?: string) {
  const draft = await prisma.order.findFirst({
    where: { sessionId: ctx.sessionId, confirmed: false, status: OrderStatus.NEW },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  if (!draft || draft.items.length === 0) {
    return { ok: false, error: "NO_PENDING_ITEMS", message: "There are no new items to confirm." };
  }

  await prisma.order.update({
    where: { id: draft.id },
    data: { confirmed: true, status: OrderStatus.NEW, specialNote: specialNote ?? draft.specialNote },
  });

  // bump order counters for analytics / bestsellers
  const tkey = todayKey();
  for (const it of draft.items) {
    if (it.menuItemId) {
      const mi = await prisma.menuItem.findUnique({ where: { id: it.menuItemId } });
      if (mi) {
        const todayOrders = mi.todayDate === tkey ? mi.todayOrders + it.quantity : it.quantity;
        await prisma.menuItem.update({
          where: { id: mi.id },
          data: { totalOrders: mi.totalOrders + it.quantity, todayOrders, todayDate: tkey },
        });
      }
    }
    if (it.comboId) {
      await prisma.combo.update({
        where: { id: it.comboId },
        data: { totalOrders: { increment: it.quantity }, todayOrders: { increment: it.quantity } },
      });
    }
  }

  await prisma.tableSession.update({ where: { id: ctx.sessionId }, data: { status: SessionStatus.ORDERED, lastActivity: new Date() } });

  const full = await prisma.order.findUnique({ where: { id: draft.id }, include: { items: true } });
  await logActivity("order.new", `Table ${ctx.tableNumber}: new order (${draft.items.length} items)`, {
    tableNumber: ctx.tableNumber,
    sessionId: ctx.sessionId,
  });

  // tell kitchen + admin
  emitAll(EVENTS.KITCHEN_ORDER_NEW, { order: full, tableNumber: ctx.tableNumber }, ctx.tableNumber);
  emit({ table: ctx.tableNumber }, EVENTS.ORDER_CONFIRMED, { orderId: draft.id });
  emit({ table: ctx.tableNumber }, EVENTS.ORDER_SENT_TO_KITCHEN, { orderId: draft.id });
  setScreen(ctx, ScreenMode.KITCHEN);
  await pushOrderUpdate(ctx);
  return { ok: true, orderId: draft.id, itemCount: draft.items.length, message: "Order sent to the kitchen!" };
}

export async function confirmOrder(ctx: ToolContext, args: { specialInstructions?: string } = {}) {
  return dispatchDraftToKitchen(ctx, args.specialInstructions);
}

export async function sendOrderToKitchen(ctx: ToolContext, args: { specialInstructions?: string } = {}) {
  return dispatchDraftToKitchen(ctx, args.specialInstructions);
}

// ---------- BILL / PAYMENT ----------

export async function requestBill(ctx: ToolContext) {
  const bill = await recomputeBill(ctx.sessionId);
  await prisma.tableSession.update({ where: { id: ctx.sessionId }, data: { status: SessionStatus.BILLING, lastActivity: new Date() } });
  emit({ table: ctx.tableNumber }, EVENTS.BILL_UPDATED, { sessionId: ctx.sessionId, bill });
  setScreen(ctx, ScreenMode.BILLING, { bill });
  emitAll(EVENTS.SESSION_UPDATED, { sessionId: ctx.sessionId, status: SessionStatus.BILLING }, ctx.tableNumber);
  return { ok: true, bill, message: "Here's your bill." };
}

export async function showPaymentQR(ctx: ToolContext, args: { method?: string } = {}) {
  const settings = await getSettings();
  const bill = await recomputeBill(ctx.sessionId);
  const amount = bill.total;
  const upiUri = `upi://pay?pa=${encodeURIComponent(settings.upiId)}&pn=${encodeURIComponent(
    settings.restaurantName
  )}&am=${amount}&cu=INR&tn=${encodeURIComponent(`Table ${ctx.tableNumber} bill`)}`;
  const qrDataUrl = await QRCode.toDataURL(upiUri, { width: 360, margin: 1 });
  await prisma.tableSession.update({ where: { id: ctx.sessionId }, data: { status: SessionStatus.BILLING } });
  const payload = { sessionId: ctx.sessionId, amount, upiId: settings.upiId, upiUri, qrDataUrl, restaurantName: settings.restaurantName, currencySymbol: settings.currencySymbol };
  emit({ table: ctx.tableNumber }, EVENTS.PAYMENT_QR_SHOW, payload);
  setScreen(ctx, ScreenMode.PAYMENT, payload);
  return { ok: true, amount, upiId: settings.upiId, message: `Showing the QR for ₹${Math.round(amount)}.` };
}

// ---------- STAFF ----------

export async function callStaff(ctx: ToolContext, args: { reason?: string } = {}) {
  const call = await prisma.staffCall.create({
    data: {
      sessionId: ctx.sessionId,
      tableNumber: ctx.tableNumber,
      reason: args.reason || "Customer requested staff",
      status: StaffCallStatus.PENDING,
    },
  });
  await logActivity("staff.call", `Table ${ctx.tableNumber} called staff`, { tableNumber: ctx.tableNumber, sessionId: ctx.sessionId });
  emitAll(EVENTS.STAFF_CALLED, { call }, ctx.tableNumber);
  setScreen(ctx, ScreenMode.STAFF, { reason: call.reason });
  return { ok: true, message: "Staff has been called — someone will be right over." };
}

// ---------- END SESSION ----------

export async function endSession(ctx: ToolContext) {
  const session = await prisma.tableSession.findUnique({ where: { id: ctx.sessionId }, include: { payments: true } });
  if (!session) return { ok: false, error: "NO_SESSION" };
  const paid = session.payments.some((p) => p.status === "SUCCESS");
  await closeSession(ctx.sessionId, SessionStatus.PAID);
  emit({ table: ctx.tableNumber }, EVENTS.SESSION_ENDED, { sessionId: ctx.sessionId, tableNumber: ctx.tableNumber });
  emitAll(EVENTS.TABLE_FREED, { tableNumber: ctx.tableNumber }, ctx.tableNumber);
  return { ok: true, paid, message: "Session ended — table is now free. Thank the guest." };
}

// ---------- STATUS / PREFERENCES ----------

export async function getKitchenStatus(ctx: ToolContext) {
  const orders = await prisma.order.findMany({
    where: { sessionId: ctx.sessionId, confirmed: true },
    include: { items: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    orders: orders.map((o) => ({
      id: o.id,
      status: o.status,
      etaMinutes: o.etaMinutes,
      items: o.items.map((i) => ({ name: i.nameEn, qty: i.quantity, status: i.status })),
    })),
  };
}

export async function getSessionPreferences(ctx: ToolContext) {
  const s = await prisma.tableSession.findUnique({ where: { id: ctx.sessionId } });
  if (!s) return {};
  return {
    veg: s.prefVeg,
    spice: s.prefSpice,
    cuisine: s.prefCuisine,
    partySize: s.partySize,
    allergies: s.allergies,
  };
}

export async function updateSessionPreferences(
  ctx: ToolContext,
  args: { veg?: string; spice?: string; cuisine?: string; partySize?: number; allergies?: string }
) {
  await updatePreferences(ctx.sessionId, {
    prefVeg: args.veg,
    prefSpice: args.spice,
    prefCuisine: args.cuisine,
    partySize: args.partySize,
    allergies: args.allergies,
  });
  emitAll(EVENTS.SESSION_UPDATED, { sessionId: ctx.sessionId }, ctx.tableNumber);
  return { ok: true, message: "Got it — noted your preferences." };
}

// ---------- tool dispatch map (name -> fn) ----------

type CtxTool = (ctx: ToolContext, args: any) => Promise<any>;
type PlainTool = (args: any) => Promise<any>;

const CTX_TOOLS: Record<string, CtxTool> = {
  showDishCards,
  showComboCards,
  addItemToOrder,
  addComboToOrder,
  removeItemFromOrder,
  updateItemQuantity,
  getCurrentOrder,
  getCurrentBill,
  confirmOrder,
  sendOrderToKitchen,
  requestBill,
  showPaymentQR,
  callStaff,
  getKitchenStatus,
  getSessionPreferences,
  updateSessionPreferences,
  endSession,
};

const PLAIN_TOOLS: Record<string, PlainTool> = {
  getMenuItems,
  searchMenuItems,
  getAvailableCombos,
  getBestSellers,
  getSlowMovingItems,
};

/** Execute a named tool with a session context. Used by chat + realtime layers. */
export async function runTool(name: string, args: any, ctx: ToolContext) {
  if (CTX_TOOLS[name]) return CTX_TOOLS[name](ctx, args ?? {});
  if (PLAIN_TOOLS[name]) return PLAIN_TOOLS[name](args ?? {});
  return { ok: false, error: "UNKNOWN_TOOL", message: `Unknown tool: ${name}` };
}

export { closeSession, getOrCreateSession, getSessionState };
