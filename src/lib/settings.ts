import { prisma } from "./prisma";

export type Settings = Awaited<ReturnType<typeof getSettings>>;

let cache: any = null;
let cacheAt = 0;
const TTL = 5000;

/** Get restaurant settings (row id=1), creating defaults if missing. Short-cached. */
export async function getSettings() {
  const now = Date.now();
  if (cache && now - cacheAt < TTL) return cache;
  let s = await prisma.restaurantSettings.findUnique({ where: { id: 1 } });
  if (!s) {
    s = await prisma.restaurantSettings.create({ data: { id: 1 } });
  }
  cache = s;
  cacheAt = now;
  return s;
}

export function invalidateSettings() {
  cache = null;
  cacheAt = 0;
}

export async function updateSettings(data: Record<string, any>) {
  const s = await prisma.restaurantSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  invalidateSettings();
  return s;
}
