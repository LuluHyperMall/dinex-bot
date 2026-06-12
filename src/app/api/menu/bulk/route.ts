import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pokeAdmin } from "@/lib/realtime";

export const dynamic = "force-dynamic";

// Bulk edit price / availability. { ids?: string[], action, value }
export async function POST(req: NextRequest) {
  const { ids, action, value } = await req.json();
  const where = ids?.length ? { id: { in: ids } } : {};
  let data: any = {};
  if (action === "setPrice") data = { price: Number(value) };
  else if (action === "adjustPrice") {
    // percentage adjust
    const items = await prisma.menuItem.findMany({ where });
    for (const it of items) {
      await prisma.menuItem.update({ where: { id: it.id }, data: { price: Math.round(it.price * (1 + Number(value) / 100)) } });
    }
    pokeAdmin();
    return NextResponse.json({ ok: true, count: items.length });
  } else if (action === "setAvailable") data = { available: !!value };
  else return NextResponse.json({ error: "unknown_action" }, { status: 400 });

  const res = await prisma.menuItem.updateMany({ where, data });
  pokeAdmin();
  return NextResponse.json({ ok: true, count: res.count });
}
