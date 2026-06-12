import { NextRequest, NextResponse } from "next/server";
import { hasOpenAI, REALTIME_MODEL } from "@/lib/openai";
import { getSettings } from "@/lib/settings";
import { buildSystemPrompt, REALTIME_TOOL_DEFS } from "@/lib/aiTools";
import { getOrCreateSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// Mint a fully-configured ephemeral OpenAI Realtime session for hands-free
// voice-to-voice. Raj's persona, tools, auto turn-detection (server VAD), and
// Whisper input transcription are all set here so the client just streams audio.
export async function POST(req: NextRequest) {
  if (!hasOpenAI()) return NextResponse.json({ enabled: false, reason: "no_api_key" });
  try {
    const { tableNumber } = await req.json();
    const n = Number(tableNumber) || 1;
    const { session } = await getOrCreateSession(n);
    const settings = await getSettings();

    const instructions =
      buildSystemPrompt(settings, n) +
      `\n\nYou are now in LIVE VOICE mode — speak naturally and concisely like a real conversation, no long monologues. Always use your tools to act (show cards, add items, bill, QR). Respond in spoken Hinglish.`;

    // GA Realtime: mint an ephemeral client secret with the full session config.
    const body = {
      session: {
        type: "realtime",
        model: REALTIME_MODEL,
        instructions,
        output_modalities: ["audio"],
        audio: {
          input: {
            transcription: { model: "whisper-1" },
            turn_detection: {
              type: "server_vad",
              threshold: 0.45,
              prefix_padding_ms: 300,
              silence_duration_ms: 500,
              create_response: true,
              interrupt_response: true,
            },
          },
          output: { voice: "ash" },
        },
        tools: REALTIME_TOOL_DEFS,
        tool_choice: "auto",
      },
    };

    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[realtime/session] openai error:", text.slice(0, 400));
      return NextResponse.json({ enabled: false, reason: "openai_error", detail: text.slice(0, 300) });
    }
    const data = await res.json();
    return NextResponse.json({
      enabled: true,
      sessionId: session.id,
      tableNumber: n,
      model: REALTIME_MODEL,
      clientSecret: data?.value, // GA returns the ephemeral key as `value`
    });
  } catch (e: any) {
    console.error("[realtime/session]", e?.message);
    return NextResponse.json({ enabled: false, reason: "exception", detail: e?.message });
  }
}
