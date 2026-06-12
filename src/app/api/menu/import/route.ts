import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseCSV } from "@/lib/csv";
import { pokeAdmin } from "@/lib/realtime";

export const dynamic = "force-dynamic";

const truthy = (v: string) => ["1", "true", "yes", "veg", "y"].includes((v || "").toLowerCase());

// POST { csv, preview } -> if preview, return parsed rows; else import.
export async function POST(req: NextRequest) {
  const { csv, preview } = await req.json();
  if (!csv) return NextResponse.json({ error: "csv required" }, { status: 400 });
  const rows = parseCSV(csv);

  const mapped = rows.map((r) => ({
    nameEn: r.item_name || r.name || "",
    nameHi: r.hindi_name || "",
    category: r.category || "Main Course",
    cuisineType: r.cuisine_type || "Indian",
    price: Number(r.price) || 0,
    isVeg: r.is_veg !== undefined ? truthy(r.is_veg) : true,
    description: r.description || "",
    prepTimeMinutes: Number(r.prep_time_minutes) || 15,
    photoUrl: r.photo_url || "",
    emoji: r.emoji || "🍽️",
    available: r.available !== undefined ? truthy(r.available) : true,
    spiceLevel: Number(r.spice_level) || 0,
    tags: r.tags || "",
  }));

  const valid = mapped.filter((m) => m.nameEn);

  if (preview) {
    return NextResponse.json({ preview: valid, total: rows.length, valid: valid.length });
  }

  let created = 0;
  for (const m of valid) {
    await prisma.menuItem.create({ data: m });
    created++;
  }
  pokeAdmin();
  return NextResponse.json({ ok: true, created });
}
