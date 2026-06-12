import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayKey(d = new Date()): string {
  // YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatMoney(n: number, symbol = "₹"): string {
  return `${symbol}${Math.round(n).toLocaleString("en-IN")}`;
}

export function minutesSince(date: Date | string): number {
  const t = typeof date === "string" ? new Date(date).getTime() : date.getTime();
  return Math.floor((Date.now() - t) / 60000);
}
