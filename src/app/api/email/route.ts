import { NextRequest, NextResponse } from "next/server";
import { sendTestEmail, sendDayReport } from "@/lib/email";
import { getDashboard } from "@/lib/admin";
import { todayKey } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { action } = await req.json();
  if (action === "test") {
    const r = await sendTestEmail();
    return NextResponse.json(r);
  }
  if (action === "report") {
    const d = await getDashboard();
    const r = await sendDayReport({
      date: todayKey(),
      revenue: d.cards.revenue,
      orders: d.cards.orders,
      sessions: d.cards.paymentsToday,
      topItem: d.cards.mostOrdered,
    });
    return NextResponse.json(r);
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
