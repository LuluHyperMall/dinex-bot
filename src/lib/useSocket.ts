"use client";
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

type Role = "table" | "kitchen" | "admin";

let shared: Socket | null = null;

function getSocket(role: Role, table?: number | string): Socket {
  // One shared connection per tab; (re)join the requested room.
  if (!shared) {
    shared = io({ path: "/socket.io", transports: ["websocket", "polling"], query: { role, table: table ?? "" } });
  }
  const join = () => shared!.emit("join", { role, table });
  if (shared.connected) join();
  else shared.on("connect", join);
  return shared;
}

/**
 * Subscribe to realtime events. `handlers` maps event name -> callback.
 * Re-binds when handlers identity changes (pass a stable object or memoize).
 */
export function useSocket(
  role: Role,
  handlers: Record<string, (payload: any) => void>,
  table?: number | string
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const socket = getSocket(role, table);
    const bound: Record<string, (p: any) => void> = {};
    for (const event of Object.keys(handlersRef.current)) {
      const fn = (payload: any) => handlersRef.current[event]?.(payload);
      bound[event] = fn;
      socket.on(event, fn);
    }
    return () => {
      for (const event of Object.keys(bound)) socket.off(event, bound[event]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, table, Object.keys(handlers).join(",")]);

  return shared;
}
