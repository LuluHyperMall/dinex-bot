"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState = {
  supported: boolean;
  listening: boolean;   // recording
  speaking: boolean;    // Raj talking
  error: string;
  start: () => void;    // start recording
  stop: () => void;     // stop recording -> fires onAudio
  speak: (text: string, opts?: { onEnd?: () => void }) => void;
  cancelSpeak: () => void;
  unlock: () => void;
};

/**
 * Voice I/O for the bot:
 *  - INPUT: record mic audio with MediaRecorder, hand the blob to onAudio
 *    (the caller sends it to /api/transcribe → Whisper). Reliable everywhere.
 *  - OUTPUT: speak() uses OpenAI TTS (/api/tts), falling back to browser TTS.
 */
export function useVoice(opts: {
  onAudio?: (blob: Blob) => void;
  useOpenAiTts?: boolean;
}): VoiceState {
  const { onAudio, useOpenAiTts = true } = opts;
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  const onAudioRef = useRef(onAudio);
  onAudioRef.current = onAudio;
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const speakingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ok = !!(navigator.mediaDevices?.getUserMedia && typeof window.MediaRecorder !== "undefined");
    setSupported(ok);
    if (!ok) setError("Recording not supported here — use Chrome/Edge, or type to Raj below.");
  }, []);

  const unlock = useCallback(() => {
    if (unlockedRef.current) return;
    unlockedRef.current = true;
    try {
      const a = new Audio();
      a.muted = true;
      a.play().catch(() => {});
      audioRef.current = a;
    } catch {}
  }, []);

  const start = useCallback(async () => {
    unlock();
    setError("");
    if (speakingRef.current) {
      try {
        audioRef.current?.pause();
        window.speechSynthesis?.cancel();
      } catch {}
      speakingRef.current = false;
      setSpeaking(false);
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setListening(false);
        if (blob.size > 800) onAudioRef.current?.(blob);
        else setError("Kuch sunai nahi diya — thoda paas aake dobara boliye.");
      };
      mr.start();
      mrRef.current = mr;
      setListening(true);
    } catch (e: any) {
      const name = e?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError")
        setError("Microphone blocked. Address bar mein 🔒 → Microphone → Allow karo, phir mic dabao.");
      else if (name === "NotFoundError") setError("Koi microphone nahi mila. Mic connect karke try karein.");
      else setError(`Mic error: ${name || e?.message || "unknown"}`);
      setListening(false);
    }
  }, [unlock]);

  const stop = useCallback(() => {
    try {
      mrRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  // ---------- TTS ----------
  const browserSpeak = useCallback((text: string, onEnd?: () => void) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      onEnd?.();
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const v =
      voices.find((x) => x.lang === "hi-IN") ||
      voices.find((x) => x.lang?.startsWith("hi")) ||
      voices.find((x) => x.lang?.startsWith("en-IN")) ||
      voices.find((x) => x.lang?.startsWith("en"));
    if (v) u.voice = v;
    u.lang = v?.lang || "en-US";
    u.onend = () => onEnd?.();
    u.onerror = () => onEnd?.();
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    async (text: string, o?: { onEnd?: () => void }) => {
      if (!text) {
        o?.onEnd?.();
        return;
      }
      speakingRef.current = true;
      setSpeaking(true);
      const finish = () => {
        speakingRef.current = false;
        setSpeaking(false);
        o?.onEnd?.();
      };
      if (useOpenAiTts) {
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 12000); // don't hang on slow TTS
          const res = await fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
            signal: ctrl.signal,
          });
          clearTimeout(to);
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const audio = audioRef.current || new Audio();
            audio.muted = false;
            audio.src = url;
            audio.onended = () => {
              URL.revokeObjectURL(url);
              finish();
            };
            audio.onerror = () => {
              URL.revokeObjectURL(url);
              browserSpeak(text, finish);
            };
            audioRef.current = audio;
            await audio.play();
            return;
          }
        } catch {
          /* fall through */
        }
      }
      browserSpeak(text, finish);
    },
    [useOpenAiTts, browserSpeak]
  );

  const cancelSpeak = useCallback(() => {
    try {
      audioRef.current?.pause();
      window.speechSynthesis?.cancel();
    } catch {}
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  return { supported, listening, speaking, error, start, stop, speak, cancelSpeak, unlock };
}
