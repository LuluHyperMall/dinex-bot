import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity";
import { emit, pokeAdmin, EVENTS } from "@/lib/realtime";

export const dynamic = "force-dynamic";

const FIELDS = [
  "nameEn", "nameHi", "category", "cuisineType", "price", "isVeg", "description",
  "prepTimeMinutes", "photoUrl", "emoji", "available", "spiceLevel", "tags",
  "bestseller", "recommended", "outOfStock",
];

function pick(body: any) {
  const data: any = {};
  for (const f of FIELDS) if (body[f] !== undefined) data[f] = body[f];
  if (data.price !== undefined) data.price = Number(data.price);
  if (data.prepTimeMinutes !== undefined) data.prepTimeMinutes = Number(data.prepTimeMinutes);
  if (data.spiceLevel !== undefined) data.spiceLevel = Number(data.spiceLevel);
  return data;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where: any = {};
  if (sp.get("category")) where.category = sp.get("category");
  if (sp.get("cuisine")) where.cuisineType = sp.get("cuisine");
  if (sp.get("veg") === "true") where.isVeg = true;
  if (sp.get("veg") === "false") where.isVeg = false;
  if (sp.get("q")) {
    const q = sp.get("q")!;
    where.OR = [{ nameEn: { contains: q } }, { nameHi: { contains: q } }, { tags: { contains: q } }];
  }
  const items = await prisma.menuItem.findMany({ where, orderBy: { nameEn: "asc" } });
  const categories = [...new Set((await prisma.menuItem.findMany({ select: { category: true } })).map((i) => i.category))];
  const cuisines = [...new Set((await prisma.menuItem.findMany({ select: { cuisineType: true } })).map((i) => i.cuisineType))];
  return NextResponse.json({ items, categories, cuisines });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const data = pick(body);
  if (!data.nameEn) return NextResponse.json({ error: "nameEn required" }, { status: 400 });
  const item = await prisma.menuItem.create({ data });
  await logActivity("item.updated", `Menu item added: ${item.nameEn}`);
  emit({ broadcast: true }, EVENTS.MENU_ITEM_UPDATED, { item });
  pokeAdmin();
  return NextResponse.json({ ok: true, item });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const data = pick(body);
  const item = await prisma.menuItem.update({ where: { id: body.id }, data });
  if (data.available === false || data.outOfStock === true)
    await logActivity("item.disabled", `Item disabled/out-of-stock: ${item.nameEn}`);
  emit({ broadcast: true }, EVENTS.MENU_ITEM_UPDATED, { item });
  pokeAdmin();
  return NextResponse.json({ ok: true, item });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.menuItem.delete({ where: { id } });
  pokeAdmin();
  return NextResponse.json({ ok: true });
}
