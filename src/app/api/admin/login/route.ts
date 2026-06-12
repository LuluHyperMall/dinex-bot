import { NextRequest, NextResponse } from "next/server";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const settings = await getSettings();
  if (String(pin) === String(settings.adminPin)) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "invalid_pin" }, { status: 401 });
}
