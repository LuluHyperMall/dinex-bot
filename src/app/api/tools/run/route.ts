import { NextRequest, NextResponse } from "next/server";
import { runTool, getOrCreateSession, type ToolContext } from "@/lib/tools";

export const dynamic = "force-dynamic";

// Execute a single AI tool with session context — used by the Realtime voice
// client to fulfill function calls (the tool's side-effects emit the realtime
// screen updates just like the text chat path).
export async function POST(req: NextRequest) {
  try {
    const { tableNumber, name, args, sessionId } = await req.json();
    const n = Number(tableNumber);
    if (!n || !name) return NextResponse.json({ ok: false, error: "tableNumber & name required" }, { status: 400 });

    let sid = sessionId as string | undefined;
    if (!sid) {
      const { session } = await getOrCreateSession(n);
      sid = session.id;
    }
    const ctx: ToolContext = { tableNumber: n, sessionId: sid };
    const result = await runTool(name, args ?? {}, ctx);
    return NextResponse.json({ ok: true, sessionId: sid, result });
  } catch (e: any) {
    console.error("[tools/run]", e?.message);
    return NextResponse.json({ ok: false, error: "failed", message: e?.message }, { status: 500 });
  }
}
