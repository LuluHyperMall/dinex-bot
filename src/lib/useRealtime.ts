"use client";
import { useCallback, useRef, useState } from "react";

type Cbs = {
  onTranscript?: (role: "user" | "assistant", text: string) => void;
  onConnected?: (sessionId: string) => void;
  onError?: (msg: string) => void;
  onEvent?: (type: string) => void;
};

/**
 * OpenAI Realtime (GA) over WebRTC — true hands-free voice-to-voice.
 *
 * Echo handling: we rely on the BROWSER's acoustic echo cancellation
 * (getUserMedia { echoCancellation:true }). The bot's audio is rendered by the
 * browser, so the AEC removes it from the mic input → the bot never hears
 * itself, but DOES hear the user (who can also interrupt it). We deliberately do
 * NOT tap the mic with a WebAudio AnalyserNode, because that disables the AEC
 * and causes self-talk loops.
 */
export function useRealtime(cbs: Cbs) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [rajSpeaking, setRajSpeaking] = useState(false);
  const [talking, setTalking] = useState(false);

  const startedRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const unmuteTimerRef = useRef<any>(null);
  const watchdogRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sessionIdRef = useRef<string>("");
  const tableRef = useRef<number>(1);
  const cbsRef = useRef(cbs);
  cbsRef.current = cbs;

  const send = (obj: any) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") dc.send(JSON.stringify(obj));
  };

  // ── Push-to-talk: mic only live while the user holds the button ──
  const startTalking = () => {
    if (!micTrackRef.current) return;
    send({ type: "input_audio_buffer.clear" });
    micTrackRef.current.enabled = true;
    setTalking(true);
  };
  const stopTalking = () => {
    if (!micTrackRef.current) return;
    micTrackRef.current.enabled = false;
    setTalking(false);
    send({ type: "input_audio_buffer.commit" });
    send({ type: "response.create" });
  };

  const runToolCall = useCallback(async (toolName: string, callId: string, argsStr: string) => {
    let args: any = {};
    try {
      args = JSON.parse(argsStr || "{}");
    } catch {}
    let result: any = { ok: false };
    try {
      const r = await fetch("/api/tools/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: tableRef.current, sessionId: sessionIdRef.current, name: toolName, args }),
      });
      const d = await r.json();
      result = d.result ?? d;
    } catch (e: any) {
      result = { ok: false, error: e?.message };
    }
    send({
      type: "conversation.item.create",
      item: { type: "function_call_output", call_id: callId, output: JSON.stringify(result).slice(0, 4000) },
    });
    send({ type: "response.create" });
  }, []);

  const handleEvent = useCallback(
    (raw: string) => {
      let e: any;
      try {
        e = JSON.parse(raw);
      } catch {
        return;
      }
      if (e.type) cbsRef.current.onEvent?.(e.type);
      switch (e.type) {
        case "input_audio_buffer.speech_started":
          setUserSpeaking(true);
          break;
        case "input_audio_buffer.speech_stopped":
          setUserSpeaking(false);
          break;
        case "conversation.item.input_audio_transcription.completed":
          if (e.transcript) cbsRef.current.onTranscript?.("user", String(e.transcript).trim());
          break;
        case "response.audio_transcript.done":
        case "response.output_audio_transcript.done":
          if (e.transcript) cbsRef.current.onTranscript?.("assistant", String(e.transcript).trim());
          break;
        case "response.created":
        case "output_audio_buffer.started":
          setRajSpeaking(true);
          break;
        case "output_audio_buffer.stopped":
        case "response.done":
          setRajSpeaking(false);
          break;
        case "response.function_call_arguments.done":
          runToolCall(e.name, e.call_id, e.arguments);
          break;
        case "error":
        case "response.error":
          // eslint-disable-next-line no-console
          console.error("[realtime]", e);
          break;
      }
    },
    [runToolCall]
  );

  const announce = useCallback((directive: string) => {
    send({
      type: "response.create",
      response: { instructions: `Say this to the guest now, in ONE short warm Hinglish sentence: ${directive}` },
    });
  }, []);

  const connect = useCallback(
    async (tableNumber: number, deviceId?: string) => {
      if (startedRef.current) return;
      startedRef.current = true;
      setConnecting(true);
      try {
        const res = await fetch("/api/realtime/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableNumber }),
        });
        const data = await res.json();
        if (!data.enabled || !data.clientSecret) {
          cbsRef.current.onError?.(
            data.reason === "no_api_key" ? "OpenAI key missing." : `Realtime unavailable (${data.reason || "error"}).`
          );
          setConnecting(false);
          startedRef.current = false;
          return;
        }
        sessionIdRef.current = data.sessionId;
        tableRef.current = data.tableNumber || tableNumber;
        cbsRef.current.onConnected?.(data.sessionId);

        const pc = new RTCPeerConnection();
        pcRef.current = pc;

        // remote audio (bot voice) — rendered by the browser so AEC can cancel it.
        // Attach to the DOM + playsInline so mobile browsers reliably play it.
        const audio = (audioRef.current ||= document.createElement("audio"));
        audio.autoplay = true;
        (audio as any).playsInline = true;
        audio.setAttribute("playsinline", "");
        audio.style.display = "none";
        if (!audio.isConnected) document.body.appendChild(audio);
        pc.ontrack = (ev) => {
          audio.srcObject = ev.streams[0];
          audio.play().catch(() => {});
        };

        // mic with echo cancellation ON (do NOT tap with WebAudio — kills AEC)
        const audioConstraints: MediaTrackConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        };
        if (deviceId) audioConstraints.deviceId = { exact: deviceId } as any;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
        streamRef.current = stream;
        stream.getTracks().forEach((t) => {
          pc.addTrack(t, stream);
          if (t.kind === "audio") {
            micTrackRef.current = t;
            t.enabled = false; // OFF until the user holds "Talk"
          }
        });

        const dc = pc.createDataChannel("oai-events");
        dcRef.current = dc;
        dc.onmessage = (m) => handleEvent(m.data);
        dc.onopen = () => {
          // PUSH-TO-TALK: no auto VAD. Mic is OFF unless the user holds the
          // button; on release we manually commit + ask for a response, so the
          // bot can NEVER hear itself → zero self-talk loop on any device.
          send({
            type: "session.update",
            session: {
              type: "realtime",
              audio: { input: { transcription: { model: "whisper-1" }, turn_detection: null } },
            },
          });
          send({
            type: "response.create",
            response: {
              instructions:
                "Say ONLY this warmly in Hinglish, nothing else: 'Namaste, kaise hain aap? Chowzy mein aapka swagat hai — aap veg khayenge ya non-veg?'",
            },
          });
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const sdpRes = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(data.model)}`, {
          method: "POST",
          body: offer.sdp,
          headers: { Authorization: `Bearer ${data.clientSecret}`, "Content-Type": "application/sdp" },
        });
        if (!sdpRes.ok) {
          cbsRef.current.onError?.("Realtime handshake failed.");
          setConnecting(false);
          startedRef.current = false;
          return;
        }
        await pc.setRemoteDescription({ type: "answer", sdp: await sdpRes.text() });

        setConnected(true);
        setConnecting(false);
      } catch (e: any) {
        const name = e?.name || "";
        if (name === "NotAllowedError") cbsRef.current.onError?.("Microphone blocked — allow mic & retry.");
        else cbsRef.current.onError?.(e?.message || "Connection failed.");
        setConnecting(false);
        startedRef.current = false;
      }
    },
    [handleEvent]
  );

  const disconnect = useCallback(() => {
    clearTimeout(unmuteTimerRef.current);
    clearTimeout(watchdogRef.current);
    micTrackRef.current = null;
    try {
      dcRef.current?.close();
    } catch {}
    try {
      pcRef.current?.close();
    } catch {}
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      audioRef.current?.pause();
    } catch {}
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    startedRef.current = false;
    setConnected(false);
    setUserSpeaking(false);
    setRajSpeaking(false);
  }, []);

  return { connect, disconnect, announce, startTalking, stopTalking, connected, connecting, talking, userSpeaking, rajSpeaking, sessionId: sessionIdRef };
}
