import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, hasOpenAI } from "@/lib/openai";

export const dynamic = "force-dynamic";

// Raj's voice via OpenAI TTS (reliable, natural Hinglish) — much better than the
// browser SpeechSynthesis on Windows, which often lacks a hi-IN voice.
export async function POST(req: NextRequest) {
  if (!hasOpenAI()) return NextResponse.json({ error: "no_key" }, { status: 400 });
  try {
    const { text, voice } = await req.json();
    if (!text) return NextResponse.json({ error: "text required" }, { status: 400 });
    const openai = getOpenAI();
    const speech = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice || "onyx", // deep, warm male voice for Raj
      input: String(text).slice(0, 1000),
      response_format: "mp3",
      speed: 1.05,
    } as any);
    const buf = Buffer.from(await speech.arrayBuffer());
    return new NextResponse(buf, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    console.error("[/api/tts]", e?.message);
    return NextResponse.json({ error: "tts_failed", message: e?.message }, { status: 500 });
  }
}
