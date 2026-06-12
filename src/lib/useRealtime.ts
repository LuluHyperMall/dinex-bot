"use client";
import { useCallback, useRef, useState } from "react";

type Cbs = {
  onTranscript?: (role: "user" | "assistant", text: string) => void;
  onConnected?: (sessionId: string) => void;
  onError?: (msg: string) => void;
  onEvent?: (type: string) => void;
};

/**
 * OpenAI Realtime API over WebRTC — true hands-free voice-to-voice.
 * The user just talks; server-VAD detects turns; Raj replies in audio.
 * Function calls are executed via /api/tools/run (which emits the same
 * realtime screen updates as the text path).
 */
export function useRealtime(cbs: Cbs) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [rajSpeaking, setRajSpeaking] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const startedRef = useRef(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micTrackRef = useRef<MediaStreamTrack | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const botSpeakingRef = useRef(false);
  const lastBotSoundRef = useRef(0);
  const acRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number>(0);
  const sessionIdRef = useRef<string>("");
  const tableRef = useRef<number>(1);
  const cbsRef = useRef(cbs);
  cbsRef.current = cbs;

  const send = (obj: any) => {
    const dc = dcRef.current;
    if (dc && dc.readyState === "open") dc.send(JSON.stringify(obj));
  };

  const runToolCall = useCallback(async (name: string, callId: string, argsStr: string) => {
    let args: any = {};
    try {
      args = JSON.parse(argsStr || "{}");
    } catch {}
    let result: any = { ok: false };
    try {
      const r = await fetch("/api/tools/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber: tableRef.current, sessionId: sessionIdRef.current, name, args }),
      });
      const d = await r.json();
      result = d.result ?? d;
    } catch (e: any) {
      result = { ok: false, error: e?.message };
    }
    // feed the result back and let Raj respond
    send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(result).slice(0, 4000) } });
    send({ type: "response.create" });
  }, []);

  const handleEvent = useCallback((raw: string) => {
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
      // NOTE: rajSpeaking + mic muting are driven by the actual bot audio level
      // in the analyser loop below (event-independent, no thrash). response.done
      // is just a safety to clear the speaking state.
      case "response.done":
        lastBotSoundRef.current = 0;
        break;
      case "response.function_call_arguments.done":
        runToolCall(e.name, e.call_id, e.arguments);
        break;
      case "error":
      case "response.error":
        console.error("[realtime event error]", e);
        cbsRef.current.onError?.(e.error?.message || e.message || "Realtime error");
        break;
      default:
        // surface anything unexpected to help debugging
        if (e.type && !e.type.includes("delta") && !e.type.startsWith("rate_limits")) {
          // eslint-disable-next-line no-console
          console.debug("[realtime]", e.type);
        }
    }
  }, [runToolCall]);

  const connect = useCallback(async (tableNumber: number, deviceId?: string) => {
    if (startedRef.current) return; // prevent double connections (overlapping voices)
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

      // remote audio (Raj's voice)
      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (ev) => {
        audio.srcObject = ev.streams[0];
        audio.play().catch(() => {});
        // tap the bot's audio so we can detect when it's actually speaking
        try {
          const ac = acRef.current;
          if (ac) {
            const src = ac.createMediaStreamSource(ev.streams[0]);
            const an = ac.createAnalyser();
            an.fftSize = 512;
            src.connect(an);
            remoteAnalyserRef.current = an;
          }
        } catch {}
      };

      // local mic
      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      if (deviceId) audioConstraints.deviceId = { exact: deviceId } as any;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      streamRef.current = stream;
      stream.getTracks().forEach((t) => {
        t.enabled = true;
        pc.addTrack(t, stream);
        if (t.kind === "audio") micTrackRef.current = t;
      });

      // mic level meter (diagnostic: is the mic actually capturing audio?)
      try {
        const AC = (window.AudioContext || (window as any).webkitAudioContext);
        const ac = new AC();
        await ac.resume().catch(() => {});
        acRef.current = ac;
        const srcNode = ac.createMediaStreamSource(stream);
        const an = ac.createAnalyser();
        an.fftSize = 512;
        srcNode.connect(an);
        const buf = new Uint8Array(an.frequencyBinCount);
        const rms = (analyser: AnalyserNode, b: Uint8Array) => {
          analyser.getByteTimeDomainData(b);
          let s = 0;
          for (let i = 0; i < b.length; i++) {
            const v = (b[i] - 128) / 128;
            s += v * v;
          }
          return Math.sqrt(s / b.length);
        };
        const tick = () => {
          // mic level (UI)
          setMicLevel(Math.min(100, Math.round(rms(an, buf) * 300)));

          // bot output level → walkie-talkie gate (mute mic while bot's voice plays)
          const ra = remoteAnalyserRef.current;
          if (ra) {
            const botRms = rms(ra, new Uint8Array(ra.frequencyBinCount));
            const now = Date.now();
            if (botRms > 0.02) {
              lastBotSoundRef.current = now;
              if (!botSpeakingRef.current) {
                botSpeakingRef.current = true;
                setRajSpeaking(true);
              }
              if (micTrackRef.current && micTrackRef.current.enabled) micTrackRef.current.enabled = false;
            } else if (botSpeakingRef.current && now - lastBotSoundRef.current > 600) {
              botSpeakingRef.current = false;
              setRajSpeaking(false);
              if (micTrackRef.current && !micTrackRef.current.enabled) micTrackRef.current.enabled = true;
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {}

      // data channel for events
      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = (m) => handleEvent(m.data);
      dc.onopen = () => {
        // assert input VAD + transcription on the live session (GA reliability)
        send({
          type: "session.update",
          session: {
            type: "realtime",
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
            },
          },
        });
        // greet immediately
        send({ type: "response.create", response: { instructions: "Greet the guest warmly in one short Hinglish line and ask veg ya non-veg, kya mood hai." } });
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
      const answer = { type: "answer" as const, sdp: await sdpRes.text() };
      await pc.setRemoteDescription(answer);

      setConnected(true);
      setConnecting(false);
    } catch (e: any) {
      const name = e?.name || "";
      if (name === "NotAllowedError") cbsRef.current.onError?.("Microphone blocked — allow mic & retry.");
      else cbsRef.current.onError?.(e?.message || "Connection failed.");
      setConnecting(false);
      startedRef.current = false;
    }
  }, [handleEvent]);

  // Make Raj say something now (kitchen updates, payment notices) using the
  // live voice — no separate/overlapping TTS.
  const announce = useCallback((directive: string) => {
    send({
      type: "response.create",
      response: { instructions: `Say this to the guest now, in ONE short warm Hinglish sentence: ${directive}` },
    });
  }, []);

  const disconnect = useCallback(() => {
    try {
      cancelAnimationFrame(rafRef.current);
      acRef.current?.close();
    } catch {}
    micTrackRef.current = null;
    remoteAnalyserRef.current = null;
    botSpeakingRef.current = false;
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
    setMicLevel(0);
  }, []);

  return { connect, disconnect, announce, connected, connecting, userSpeaking, rajSpeaking, micLevel, sessionId: sessionIdRef };
}
