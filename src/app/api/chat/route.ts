import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, hasOpenAI, CHAT_MODEL } from "@/lib/openai";
import { TOOL_DEFS, buildSystemPrompt } from "@/lib/aiTools";
import { runTool, getOrCreateSession, type ToolContext } from "@/lib/tools";
import { getSettings } from "@/lib/settings";
import { fallbackRespond } from "@/lib/fallbackBrain";

export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const tableNumber = Number(body.tableNumber);
    let sessionId: string = body.sessionId;
    const history: ChatMessage[] = (body.messages || [])
      .filter((m: ChatMessage) => m && typeof m.content === "string" && m.content.trim())
      .slice(-12);
    const lastShownIds: string[] = body.lastShownIds || [];

    if (history.length === 0) {
      return NextResponse.json({
        sessionId: sessionId || "",
        reply: "Ji, main sun raha hoon — dobara boliye? 😊",
        toolCalls: [],
        lastShownIds,
        engine: "noop",
      });
    }

    if (!tableNumber || Number.isNaN(tableNumber)) {
      return NextResponse.json({ error: "tableNumber required" }, { status: 400 });
    }

    // Ensure a session exists
    if (!sessionId) {
      const { session } = await getOrCreateSession(tableNumber);
      sessionId = session.id;
    }
    const ctx: ToolContext = { tableNumber, sessionId };
    const settings = await getSettings();

    // ---------- Fallback (no key) ----------
    if (!hasOpenAI()) {
      const lastUser = [...history].reverse().find((m) => m.role === "user");
      const fb = await fallbackRespond(lastUser?.content || "hello", ctx, lastShownIds);
      return NextResponse.json({
        sessionId,
        reply: fb.reply,
        toolCalls: fb.toolCalls.map((c) => c.name),
        lastShownIds: fb.lastShownIds ?? lastShownIds,
        engine: "local",
      });
    }

    // ---------- GPT-4o tool-calling loop ----------
    const openai = getOpenAI();
    const messages: any[] = [
      { role: "system", content: buildSystemPrompt(settings, tableNumber) },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    let reply = "";
    const toolCallNames: string[] = [];
    let newLastShown = lastShownIds;

    for (let i = 0; i < 6; i++) {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        messages,
        tools: TOOL_DEFS as any,
        tool_choice: "auto",
        temperature: 0.5,
        max_tokens: 500,
      });
      const msg = completion.choices[0].message;
      messages.push(msg);

      if (msg.tool_calls && msg.tool_calls.length) {
        for (const tc of msg.tool_calls) {
          const name = tc.function.name;
          let args: any = {};
          try {
            args = JSON.parse(tc.function.arguments || "{}");
          } catch {}
          toolCallNames.push(name);
          const result = await runTool(name, args, ctx);
          // capture positional context for "pehla wala"
          if (name === "showDishCards" && result?.dishes) newLastShown = result.dishes.map((d: any) => d.id);
          if (name === "showComboCards" && result?.combos) newLastShown = result.combos.map((c: any) => c.id);
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 4000) });
        }
        continue; // let the model react to tool results
      }

      reply = msg.content || "";
      break;
    }

    return NextResponse.json({
      sessionId,
      reply: reply || "Ji, bataiye?",
      toolCalls: toolCallNames,
      lastShownIds: newLastShown,
      engine: "gpt-4o",
    });
  } catch (err: any) {
    console.error("[/api/chat] error:", err?.message || err);
    return NextResponse.json({ error: "chat_failed", message: err?.message }, { status: 500 });
  }
}
