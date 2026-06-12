import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emit, pokeAdmin, EVENTS } from "@/lib/realtime";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

async function computeOriginal(items: { menuItemId: string; quantity: number }[]) {
  let original = 0;
  for (const it of items) {
    const m = await prisma.menuItem.findUnique({ where: { id: it.menuItemId } });
    if (m) original += m.price * it.quantity;
  }
  return original;
}

export async function GET() {
  const combos = await prisma.combo.findMany({ include: { items: { include: { menuItem: true } } }, orderBy: { nameEn: "asc" } });
  return NextResponse.json({ combos });
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  const items: { menuItemId: string; quantity: number }[] = (b.items || []).map((i: any) => ({ menuItemId: i.menuItemId, quantity: Number(i.quantity) || 1 }));
  const original = await computeOriginal(items);
  const comboPrice = Number(b.comboPrice) || original;
  const combo = await prisma.combo.create({
    data: {
      nameEn: b.nameEn,
      nameHi: b.nameHi || "",
      description: b.description || "",
      category: b.category || "Combo",
      emoji: b.emoji || "🍱",
      photoUrl: b.photoUrl || "",
      originalPrice: original,
      comboPrice,
      savings: original - comboPrice,
      active: b.active !== false,
      items: { create: items },
    },
    include: { items: { include: { menuItem: true } } },
  });
  await logActivity("combo.updated", `Combo created: ${combo.nameEn}`);
  emit({ broadcast: true }, EVENTS.COMBO_UPDATED, { combo });
  pokeAdmin();
  return NextResponse.json({ ok: true, combo });
}

export async function PATCH(req: NextRequest) {
  const b = await req.json();
  if (!b.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data: any = {};
  for (const f of ["nameEn", "nameHi", "description", "category", "emoji", "photoUrl", "active"]) if (b[f] !== undefined) data[f] = b[f];

  if (b.items) {
    const items = b.items.map((i: any) => ({ menuItemId: i.menuItemId, quantity: Number(i.quantity) || 1 }));
    const original = await computeOriginal(items);
    const comboPrice = Number(b.comboPrice) || original;
    data.originalPrice = original;
    data.comboPrice = comboPrice;
    data.savings = original - comboPrice;
    await prisma.comboItem.deleteMany({ where: { comboId: b.id } });
    data.items = { create: items };
  } else if (b.comboPrice !== undefined) {
    const existing = await prisma.combo.findUnique({ where: { id: b.id } });
    data.comboPrice = Number(b.comboPrice);
    data.savings = (existing?.originalPrice || 0) - Number(b.comboPrice);
  }

  const combo = await prisma.combo.update({ where: { id: b.id }, data, include: { items: { include: { menuItem: true } } } });
  emit({ broadcast: true }, EVENTS.COMBO_UPDATED, { combo });
  pokeAdmin();
  return NextResponse.json({ ok: true, combo });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.combo.delete({ where: { id } });
  pokeAdmin();
  return NextResponse.json({ ok: true });
}
