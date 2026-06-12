import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ settings: s });
}

const NUM = ["gstPercent", "serviceChargePercent", "numberOfTables", "aiHumorLevel", "urgencyWarningMin", "urgencyUrgentMin", "urgencyCriticalMin"];
const BOOL = ["emailReportsEnabled"];
const STR = ["restaurantName", "logoText", "adminPin", "upiId", "currency", "currencySymbol", "languagePreference", "aiWaiterName", "emailAddress", "gmailAppPassword"];

export async function PUT(req: NextRequest) {
  const b = await req.json();
  const data: any = {};
  for (const f of NUM) if (b[f] !== undefined) data[f] = Number(b[f]);
  for (const f of BOOL) if (b[f] !== undefined) data[f] = !!b[f];
  for (const f of STR) if (b[f] !== undefined) data[f] = String(b[f]);
  const settings = await updateSettings(data);
  return NextResponse.json({ ok: true, settings });
}
