import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { getOpenAI, hasOpenAI } from "@/lib/openai";

export const dynamic = "force-dynamic";

// Speech-to-text via OpenAI Whisper. Reliable across browsers + great at
// Hinglish/code-switched audio (far better than browser SpeechRecognition).
export async function POST(req: NextRequest) {
  if (!hasOpenAI()) return NextResponse.json({ error: "no_key", text: "" }, { status: 400 });
  try {
    const form = await req.formData();
    const blob = form.get("audio") as File | null;
    if (!blob) return NextResponse.json({ error: "audio required", text: "" }, { status: 400 });

    const buf = Buffer.from(await blob.arrayBuffer());
    if (buf.length < 800) return NextResponse.json({ text: "" }); // too short / silence

    const openai = getOpenAI();
    const type = blob.type || "audio/webm";
    const ext = type.includes("mpeg") || type.includes("mp3")
      ? "mp3"
      : type.includes("mp4") || type.includes("m4a")
      ? "m4a"
      : type.includes("ogg")
      ? "ogg"
      : type.includes("wav")
      ? "wav"
      : "webm";
    const file = await toFile(buf, `speech.${ext}`, { type });
    const tr = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "hi", // Indian context → Devanagari (avoids Urdu-script output)
      prompt: "Hinglish restaurant order. Items: Butter Chicken, Paneer Tikka, Dal Makhani, Biryani, Naan, Lassi, combo, bill, QR.",
    });
    return NextResponse.json({ text: tr.text || "" });
  } catch (e: any) {
    console.error("[/api/transcribe]", e?.message);
    return NextResponse.json({ error: "transcribe_failed", message: e?.message, text: "" }, { status: 500 });
  }
}
