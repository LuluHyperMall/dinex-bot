// Server-side realtime emit helper.
// The custom server (server.ts) attaches the Socket.IO instance to globalThis
// so Next.js route handlers (same process) can broadcast without a separate
// transport. All emits are best-effort: if io is not ready, they no-op.

import type { Server as IOServer } from "socket.io";
import { EVENTS, ROOMS, type EventName } from "./events";

const g = globalThis as unknown as { __dinexIo?: IOServer };

export function getIO(): IOServer | undefined {
  return g.__dinexIo;
}

export function setIO(io: IOServer) {
  g.__dinexIo = io;
}

type Target =
  | { room: string }
  | { table: number | string }
  | { kitchen: true }
  | { admin: true }
  | { broadcast: true };

/** Emit to a specific target (table room / kitchen / admin / everyone). */
export function emit(target: Target, event: EventName, payload: unknown) {
  const io = getIO();
  if (!io) return;
  if ("broadcast" in target) io.emit(event, payload);
  else if ("table" in target) io.to(ROOMS.table(target.table)).emit(event, payload);
  else if ("kitchen" in target) io.to(ROOMS.KITCHEN).emit(event, payload);
  else if ("admin" in target) io.to(ROOMS.ADMIN).emit(event, payload);
  else io.to(target.room).emit(event, payload);
}

/** Convenience: emit the same event to a table + kitchen + admin at once. */
export function emitAll(event: EventName, payload: unknown, table?: number | string) {
  const io = getIO();
  if (!io) return;
  io.to(ROOMS.KITCHEN).emit(event, payload);
  io.to(ROOMS.ADMIN).emit(event, payload);
  if (table !== undefined) io.to(ROOMS.table(table)).emit(event, payload);
}

/** Tell admin dashboards to refresh their snapshot. */
export function pokeAdmin() {
  emit({ admin: true }, EVENTS.ADMIN_DASHBOARD_UPDATED, { at: Date.now() });
}

export { EVENTS, ROOMS };
