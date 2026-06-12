"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2, Loader2, Radio, PhoneOff } from "lucide-react";
import { useVoice } from "@/lib/useVoice";
import { useRealtime } from "@/lib/useRealtime";
import { useSocket } from "@/lib/useSocket";
import { EVENTS } from "@/lib/events";
import { ScreenMode } from "@/lib/enums";
import { Button } from "@/components/ui/button";
import { RajFace } from "./RajFace";
import { cn } from "@/lib/utils";
import {
  DishCard,
  ComboCard,
  OrderPanel,
  BillPanel,
  PaymentPanel,
  KitchenStatusPanel,
  StaffPanel,
} from "./panels";

type Msg = { role: "user" | "assistant"; content: string };

export function BotClient({ tableNumber }: { tableNumber: number }) {
  const [sessionId, setSessionId] = useState<string>("");
  const [settings, setSettings] = useState<any>({ aiWaiterName: "Raj", restaurantName: "Swad Mahal" });
  const [mode, setMode] = useState<string>(ScreenMode.IDLE);
  const [dishes, setDishes] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [cardTitle, setCardTitle] = useState("");
  const [orderItems, setOrderItems] = useState<any[]>([]);
  const [bill, setBill] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [staffReason, setStaffReason] = useState<string>("");
  const [paymentDone, setPaymentDone] = useState(false);
  const [ended, setEnded] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [engine, setEngine] = useState<string>("");

  const lastShownIdsRef = useRef<string[]>([]);
  const messagesRef = useRef<Msg[]>([]);
  messagesRef.current = messages;
  const greetedRef = useRef(false);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // ---------- voice (record -> Whisper -> chat) ----------
  const handleAudio = useCallback(async (blob: Blob) => {
    setTranscribing(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "speech.webm");
      const r = await fetch("/api/transcribe", { method: "POST", body: fd });
      const d = await r.json();
      setTranscribing(false);
      const text = (d.text || "").trim();
      if (text) sendToRaj(text);
    } catch {
      setTranscribing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const voice = useVoice({ onAudio: handleAudio });

  // ---------- LIVE realtime voice-to-voice (hands-free) ----------
  const [liveError, setLiveError] = useState("");
  const [micHeard, setMicHeard] = useState(false);
  const [lastEvent, setLastEvent] = useState("");
  const live = useRealtime({
    onTranscript: (role, text) => {
      if (text) setMessages((m) => [...m, { role, content: text }]);
      if (role === "user") refreshState();
    },
    onConnected: (sid) => {
      if (sid) setSessionId(sid);
      setEngine("realtime");
    },
    onError: (msg) => setLiveError(msg),
    onEvent: (type) => {
      setLastEvent(type);
      if (type === "input_audio_buffer.speech_started" || type === "conversation.item.input_audio_transcription.completed") {
        setMicHeard(true);
      }
    },
  });

  const [micDevices, setMicDevices] = useState<{ id: string; label: string }[]>([]);
  const [selectedMic, setSelectedMic] = useState("");

  const loadMics = async () => {
    try {
      const tmp = await navigator.mediaDevices.getUserMedia({ audio: true });
      tmp.getTracks().forEach((t) => t.stop());
      const devs = await navigator.mediaDevices.enumerateDevices();
      const mics = devs.filter((d) => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId, label: d.label || `Microphone ${i + 1}` }));
      setMicDevices(mics);
      if (mics[0] && !selectedMic) setSelectedMic(mics[0].id);
    } catch {
      setLiveError("Mic permission chahiye — browser address bar 🔒 → Microphone → Allow.");
    }
  };

  const startLive = () => {
    setLiveError("");
    setMicHeard(false);
    voice.cancelSpeak();
    if (voice.listening) voice.stop();
    live.connect(tableNumber, selectedMic || undefined);
  };

  // ---------- realtime ----------
  useSocket(
    "table",
    {
      [EVENTS.SCREEN_MODE_CHANGED]: (p) => {
        if (p?.mode) setMode(p.mode);
        if (p?.title !== undefined) setCardTitle(p.title);
        if (p?.reason) setStaffReason(p.reason);
        if (p?.bill) setBill(p.bill);
      },
      [EVENTS.DISHES_SHOW]: (p) => {
        setDishes(p.dishes || []);
        setCardTitle(p.title || "");
        setMode(ScreenMode.DISHES);
      },
      [EVENTS.COMBOS_SHOW]: (p) => {
        setCombos(p.combos || []);
        setCardTitle(p.title || "");
        setMode(ScreenMode.COMBOS);
      },
      [EVENTS.ORDER_UPDATED]: (p) => {
        setOrderItems(p.orderItems || []);
        if (p.bill) setBill(p.bill);
      },
      [EVENTS.BILL_UPDATED]: (p) => {
        if (p.bill) setBill(p.bill);
      },
      [EVENTS.PAYMENT_QR_SHOW]: (p) => {
        setPayment(p);
        setMode(ScreenMode.PAYMENT);
      },
      [EVENTS.PAYMENT_SUCCESS]: () => {
        setPaymentDone(true);
        flash(
          "Payment ho gaya ji, dhanyavaad! 🙏 Khana pasand aaya? Bataiye, session end kar dun?",
          "Payment is successful. Warmly thank the guest, ask if they enjoyed the food, and ask 'kya main aapka session end kar dun?'"
        );
      },
      [EVENTS.SESSION_ENDED]: () => {
        setEnded(true);
        setTimeout(() => {
          try {
            live.disconnect();
          } catch {}
        }, 4000);
      },
      [EVENTS.KITCHEN_ORDER_COOKING]: () => {
        refreshState();
        flash("Kitchen mein aapka khana ban-na shuru ho gaya hai! 👨‍🍳", "Tell the guest the kitchen has started cooking their order.");
      },
      [EVENTS.KITCHEN_ORDER_ETA]: (p) => {
        refreshState();
        if (p?.etaMinutes)
          flash(`Aapka khaana lagbhag ${p.etaMinutes} minute mein ready ho jaayega! 🍳`, `Tell the guest their food will be ready in about ${p.etaMinutes} minutes.`);
      },
      [EVENTS.KITCHEN_ORDER_READY]: () => {
        refreshState();
        flash("Aapka khaana ready hai, garma-garam aa raha hai! 🔔", "Excitedly tell the guest their food is ready and on its way.");
      },
      [EVENTS.KITCHEN_ORDER_SERVED]: () => {
        refreshState();
        flash("Aapka khaana serve kar diya gaya hai — enjoy kijiye! 😋", "Tell the guest their food has been served, wish them enjoy.");
      },
      [EVENTS.KITCHEN_ORDER_DELAYED]: (p) => {
        refreshState();
        flash(p?.message || "Thodi der aur lagegi ji, sabra rakhiye 🙏", "Politely tell the guest there's a small delay and thank them for patience.");
      },
      [EVENTS.STAFF_CALLED]: (p) => {
        setStaffReason(p?.call?.reason || "");
      },
      [EVENTS.STAFF_RESOLVED]: () => {
        if (mode === ScreenMode.STAFF) setMode(ScreenMode.IDLE);
      },
      [EVENTS.ADMIN_MESSAGE]: (p) => {
        if (p?.message) flash(p.message);
      },
    },
    tableNumber
  );

  // ---------- init ----------
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableNumber }),
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      if (data.settings) setSettings(data.settings);
      if (data.state) {
        setOrderItems(data.state.orderItems || []);
        setBill(data.state.bill || null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableNumber]);

  // auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const refreshState = useCallback(async () => {
    if (!sessionId) return;
    const r = await fetch(`/api/session?sessionId=${sessionId}`);
    if (!r.ok) return;
    const { state } = await r.json();
    setOrderItems(state.orderItems || []);
    setBill(state.bill || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const liveConnectedRef = useRef(false);
  liveConnectedRef.current = live.connected;

  const flash = useCallback(
    (text: string, directive?: string) => {
      setMessages((m) => [...m, { role: "assistant", content: text }]);
      // In live mode the realtime voice speaks it (no overlapping TTS); else browser/OpenAI TTS.
      if (liveConnectedRef.current) live.announce(directive || text);
      else voice.speak(text);
    },
    [voice, live]
  );

  // ---------- chat ----------
  const sendToRaj = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      const next = [...messagesRef.current, { role: "user" as const, content: text }];
      setMessages(next);
      setThinking(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableNumber,
            sessionId,
            messages: next,
            lastShownIds: lastShownIdsRef.current,
          }),
        });
        const data = await res.json();
        if (data.sessionId && !sessionId) setSessionId(data.sessionId);
        if (data.lastShownIds) lastShownIdsRef.current = data.lastShownIds;
        if (data.engine) setEngine(data.engine);
        const reply = data.reply || "Ji, bataiye?";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        setThinking(false);
        voice.speak(reply);
      } catch (e) {
        setThinking(false);
        const err = "Maaf kijiye, thodi technical dikkat aa gayi. Dobara boliye?";
        setMessages((m) => [...m, { role: "assistant", content: err }]);
        voice.speak(err);
      }
    },
    [sessionId, tableNumber, voice]
  );

  // greet once session is ready
  useEffect(() => {
    if (sessionId && !greetedRef.current) {
      greetedRef.current = true;
      const greeting = `Namaste ji! Main ${settings.aiWaiterName || "Raj"} — “🎙️ Live Baat shuru karo” dabaiye aur mujhse seedhe baat kijiye. 😄`;
      // text only — no auto-speak (avoids overlapping with live voice)
      setMessages((m) => (m.length === 0 ? [{ role: "assistant", content: greeting }] : m));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const toggleMic = () => {
    if (voice.listening) voice.stop();
    else voice.start();
  };

  const submitText = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      sendToRaj(textInput.trim());
      setTextInput("");
    }
  };

  const payNow = async (method: string) => {
    if (!sessionId) return;
    if (method === "CASH") {
      // cash is confirmed by staff/kitchen; just request it
      await fetch("/api/payment/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", sessionId }),
      });
      flash("Cash payment ke liye staff ko bata diya — wo aake confirm karenge. 💵");
      return;
    }
    // success is handled by the PAYMENT_SUCCESS socket event (Raj announces it)
    await fetch("/api/payment/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, method, amount: payment?.amount ?? bill?.total }),
    });
  };

  const status = live.connected
    ? live.rajSpeaking
      ? "speaking"
      : live.talking
      ? "listening"
      : "idle"
    : thinking || transcribing
    ? "thinking"
    : voice.speaking
    ? "speaking"
    : voice.listening
    ? "listening"
    : "idle";

  const waiterName = settings.aiWaiterName || "Dinex Bot";

  // ── WAKE SCREEN — tap anywhere to activate ──────────────────────
  if (!live.connected && !ended) {
    return (
      <div
        onClick={() => !live.connecting && startLive()}
        className="bot-bg flex min-h-screen cursor-pointer flex-col items-center justify-center px-6 text-center text-white"
      >
        <RajFace status={live.connecting ? "thinking" : "idle"} name={waiterName} />
        <p className="mt-6 text-xs uppercase tracking-[0.35em] text-white/40">{settings.restaurantName}</p>
        {live.connecting ? (
          <p className="mt-8 animate-pulse text-2xl font-bold text-sky-300">Jaag raha hoon…</p>
        ) : (
          <>
            <p className="mt-8 animate-pulse text-3xl font-black text-primary">👆 Tap to wake me</p>
            <p className="mt-3 text-white/50">
              Tap karke shuru karo — phir <b className="text-white/80">🎤 button daba ke</b> boliye, chhodo to bhej jayega
            </p>
          </>
        )}
        {liveError && (
          <p className="mt-6 max-w-xs rounded-lg bg-red-500/15 px-4 py-2 text-sm text-red-300">{liveError}</p>
        )}
      </div>
    );
  }

  // ── ENDED SCREEN ────────────────────────────────────────────────
  if (ended) {
    return (
      <div className="bot-bg flex min-h-screen flex-col items-center justify-center text-center text-white">
        <div className="text-7xl">🙏</div>
        <h2 className="mt-4 text-4xl font-black">Dhanyavaad!</h2>
        <p className="mt-2 text-white/60">Aapka session end ho gaya, table ab free hai.</p>
        <p className="mt-1 text-white/40">{settings.restaurantName} — phir aaiyega!</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-8 rounded-full bg-primary px-8 py-3 text-lg font-bold text-primary-foreground"
        >
          Naya order shuru karein
        </button>
      </div>
    );
  }

  // ── ACTIVE — live conversation (push-to-talk) ───────────────────
  const statusText = live.talking
    ? "🔴 Sun raha hoon… boliye"
    : live.rajSpeaking
    ? `${waiterName} bol raha hai…`
    : "Button daba ke boliye 👇";

  return (
    <div className="bot-bg flex min-h-screen flex-col text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "h-3 w-3 rounded-full",
              live.rajSpeaking ? "bg-green-400" : live.userSpeaking ? "animate-pulse bg-sky-400" : "bg-primary"
            )}
          />
          <span className="font-bold">{settings.restaurantName}</span>
          <span className="text-white/40">· Table {tableNumber}</span>
        </div>
        <button
          onClick={live.disconnect}
          className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/50 hover:bg-white/10"
        >
          End
        </button>
      </header>

      <div className="grid flex-1 gap-6 p-5 lg:grid-cols-[280px_1fr]">
        {/* left: orb + status + last few lines */}
        <div className="flex flex-col items-center">
          <div className="mt-4">
            <RajFace status={status as any} name={waiterName} />
          </div>
          <p className="mt-4 h-5 text-center text-sm text-white/50">{statusText}</p>

          {/* HOLD TO TALK — mic only live while held (no self-talk possible) */}
          <button
            onPointerDown={(e) => {
              e.preventDefault();
              if (!live.rajSpeaking) live.startTalking();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              if (live.talking) live.stopTalking();
            }}
            onPointerLeave={() => {
              if (live.talking) live.stopTalking();
            }}
            disabled={live.rajSpeaking}
            className={cn(
              "mt-5 select-none rounded-full px-8 py-5 text-lg font-bold shadow-lg transition-all touch-none",
              live.talking
                ? "scale-105 bg-red-600 animate-pulse"
                : live.rajSpeaking
                ? "bg-white/10 text-white/40"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {live.talking ? "🎙️ Bol rahe ho… (chhodo to bhejo)" : live.rajSpeaking ? "Dinex bol raha hai…" : "🎤 Hold karke boliye"}
          </button>

          <div className="mt-6 w-full space-y-2">
            {messages.slice(-3).map((m, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-2xl px-4 py-2 text-sm animate-fade-in",
                  m.role === "user" ? "bg-sky-500/15 text-right" : "bg-white/5"
                )}
              >
                {m.content}
              </div>
            ))}
          </div>
        </div>

        {/* right: visual context (cards / order / bill / QR) */}
        <div className="min-h-[60vh]">
          <ContextScreen
            mode={mode}
            cardTitle={cardTitle}
            dishes={dishes}
            combos={combos}
            orderItems={orderItems}
            bill={bill}
            payment={payment}
            paymentDone={paymentDone}
            staffReason={staffReason}
            onPay={payNow}
            settings={settings}
          />
        </div>
      </div>
    </div>
  );
}

function ContextScreen({
  mode,
  cardTitle,
  dishes,
  combos,
  orderItems,
  bill,
  payment,
  paymentDone,
  staffReason,
  onPay,
  settings,
}: any) {
  if (mode === "ended") {
    return (
      <div className="glass flex h-full flex-col items-center justify-center rounded-2xl p-10 text-center animate-fade-in">
        <div className="text-7xl">🙏</div>
        <h2 className="mt-4 text-3xl font-black">Dhanyavaad!</h2>
        <p className="mt-2 text-white/60">Aapka session end ho gaya, table ab free hai.</p>
        <p className="mt-1 text-white/40">{settings.restaurantName} — phir aaiyega!</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-primary px-6 py-3 font-bold text-primary-foreground"
        >
          Naya order shuru karein
        </button>
      </div>
    );
  }

  if (mode === ScreenMode.DISHES && dishes.length) {
    return (
      <div>
        {cardTitle && <h2 className="mb-4 text-2xl font-bold">{cardTitle}</h2>}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {dishes.map((d: any, i: number) => (
            <DishCard key={d.id} dish={d} index={i} />
          ))}
        </div>
        <p className="mt-5 text-center text-white/40">Boliye “pehla wala add karo” ya “dusra wala chahiye” 🎙️</p>
      </div>
    );
  }

  if (mode === ScreenMode.COMBOS && combos.length) {
    return (
      <div>
        {cardTitle && <h2 className="mb-4 text-2xl font-bold">{cardTitle}</h2>}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {combos.map((c: any, i: number) => (
            <ComboCard key={c.id} combo={c} index={i} />
          ))}
        </div>
        <p className="mt-5 text-center text-white/40">Boliye “ye combo add karo” 🎙️</p>
      </div>
    );
  }

  if (mode === ScreenMode.KITCHEN) return <KitchenStatusPanel items={orderItems} />;
  if (mode === ScreenMode.BILLING) return <BillPanel bill={bill} />;
  if (mode === ScreenMode.STAFF) return <StaffPanel reason={staffReason} />;
  if (mode === ScreenMode.PAYMENT)
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentPanel payload={payment} />
        <div className="glass rounded-2xl p-6">
          {paymentDone ? (
            <div className="text-center">
              <div className="text-6xl">✅</div>
              <h3 className="mt-3 text-2xl font-black">Payment Successful</h3>
              <p className="mt-2 text-white/60">Raj se kaho <b>“haan, session end karo”</b> jab khana ho jaaye — table free ho jayega.</p>
            </div>
          ) : (
            <>
              <h3 className="text-lg font-bold">Demo Payment</h3>
              <p className="mt-1 text-sm text-white/50">Choose a method to simulate payment.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button onClick={() => onPay("UPI")} className="h-14">📲 UPI</Button>
                <Button onClick={() => onPay("CARD")} variant="secondary" className="h-14">💳 Card</Button>
                <Button onClick={() => onPay("CASH")} variant="secondary" className="h-14">💵 Cash</Button>
                <Button onClick={() => onPay("WALLET")} variant="secondary" className="h-14">👛 Wallet</Button>
              </div>
            </>
          )}
        </div>
      </div>
    );

  // idle / order default — show live order
  return <OrderPanel items={orderItems} bill={bill} />;
}
