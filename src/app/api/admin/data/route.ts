import { NextRequest, NextResponse } from "next/server";
import { getDashboard, getTableGrid, getLiveOrders, getBilling, getHistory, getAnalytics } from "@/lib/admin";
import { getKitchenBoard } from "@/lib/kitchen";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const section = sp.get("section") || "dashboard";
  try {
    switch (section) {
      case "dashboard":
        return NextResponse.json(await getDashboard());
      case "tables":
        return NextResponse.json({ grid: await getTableGrid() });
      case "orders":
        return NextResponse.json({ orders: await getLiveOrders() });
      case "kitchen":
        return NextResponse.json(await getKitchenBoard());
      case "billing":
        return NextResponse.json(await getBilling());
      case "analytics":
        return NextResponse.json(await getAnalytics());
      case "history":
        return NextResponse.json({
          rows: await getHistory({
            date: sp.get("date") || undefined,
            table: sp.get("table") ? Number(sp.get("table")) : undefined,
            method: sp.get("method") || undefined,
            q: sp.get("q") || undefined,
          }),
        });
      default:
        return NextResponse.json({ error: "unknown_section" }, { status: 400 });
    }
  } catch (e: any) {
    console.error("[admin/data]", section, e?.message);
    return NextResponse.json({ error: "failed", message: e?.message }, { status: 500 });
  }
}
