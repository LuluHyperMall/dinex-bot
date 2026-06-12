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
      : live.userSpeaking
      ? "listening"
      : "idle"
    : thinking || transcribing
    ? "thinking"
    : voice.speaking
    ? "speaking"
    : voice.listening
    ? "listening"
    : "idle";

  return (
    <div className="bot-bg min-h-screen text-white">
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span className="font-bold">{settings.restaurantName}</span>
          <span className="text-white/40">• Table {tableNumber}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-white/40">
          {engine && <span>brain: {engine}</span>}
          {!voice.supported && <span className="text-amber-400">mic not supported — type below</span>}
        </div>
      </div>

      <div className="grid gap-6 p-6 lg:grid-cols-[380px_1fr]">
        {/* left: Raj + transcript + mic */}
        <div className="flex flex-col">
          <div className="glass rounded-2xl p-6">
            <div className="py-4">
              <RajFace status={status as any} name={settings.aiWaiterName || "Raj"} />
            </div>
            {/* LIVE hands-free mode (primary) */}
            <div className="mt-4 flex flex-col items-center gap-2">
              {!live.connected && (
                <div className="flex w-full items-center gap-2">
                  <select
                    value={selectedMic}
                    onChange={(e) => setSelectedMic(e.target.value)}
                    onFocus={() => micDevices.length === 0 && loadMics()}
                    className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-white/70"
                  >
                    {micDevices.length === 0 ? (
                      <option value="">Default mic (click to choose)</option>
                    ) : (
                      micDevices.map((m) => (
                        <option key={m.id} value={m.id} className="bg-[#0e1426]">
                          {m.label}
                        </option>
                      ))
                    )}
                  </select>
                  <Button size="sm" variant="ghost" onClick={loadMics}>Mics</Button>
                </div>
              )}
              {!live.connected ? (
                <Button
                  size="xl"
                  onClick={startLive}
                  disabled={live.connecting}
                  className="rounded-full bg-green-600 hover:bg-green-700"
                >
                  <Radio className="h-6 w-6" />
                  {live.connecting ? "Connect ho raha…" : "👆 Tap karke order shuru karein"}
                </Button>
              ) : (
                <Button size="xl" onClick={live.disconnect} className="rounded-full bg-red-600 hover:bg-red-700">
                  <PhoneOff className="h-6 w-6" /> Live band karo
                </Button>
              )}
              {live.connected && (
                <>
                  <p className="text-center text-sm text-green-300">
                    🟢 LIVE — bas boliye, button dabane ki zaroorat nahi.
                    {live.userSpeaking ? " (sun raha hoon…)" : live.rajSpeaking ? " (Raj bol raha…)" : ""}
                  </p>
                  <div className="mt-1 rounded-lg bg-white/5 px-3 py-1.5 text-[11px] text-white/50">
                    <div className="flex items-center gap-2">
                      <span>mic level:</span>
                      <div className="h-2 flex-1 overflow-hidden rounded bg-white/10">
                        <div
                          className={cn("h-full transition-[width] duration-75", live.micLevel > 8 ? "bg-green-400" : "bg-white/30")}
                          style={{ width: `${Math.min(100, live.micLevel)}%` }}
                        />
                      </div>
                      <span className="w-8 text-right">{live.micLevel}</span>
                    </div>
                    <div className="mt-1 text-center">
                      mic heard you: <b className={micHeard ? "text-green-400" : "text-red-400"}>{micHeard ? "YES ✓" : "NOT YET ✗"}</b>
                      {lastEvent ? <span> · {lastEvent}</span> : null}
                    </div>
                  </div>
                </>
              )}
              {liveError && (
                <p className="rounded-lg bg-red-500/15 px-3 py-2 text-center text-xs text-red-300">{liveError}</p>
              )}
            </div>

            {/* manual fallback (tap-to-record + text) */}
            {!live.connected && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="mb-2 text-center text-[11px] uppercase tracking-widest text-white/30">ya manually</p>
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={toggleMic}
                    disabled={!voice.supported || transcribing}
                    className={cn("rounded-full", voice.listening && "bg-red-600 hover:bg-red-700 animate-pulse text-white")}
                  >
                    {voice.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                    {voice.listening ? "Bol diya? Tap to send" : transcribing ? "Samajh raha hoon…" : "Tap to record"}
                  </Button>
                </div>
              </div>
            )}
            {voice.listening && (
              <p className="mt-3 text-center text-sm text-red-300">🔴 Recording… boliye, phir button dobara dabao</p>
            )}
            {transcribing && (
              <p className="mt-3 text-center text-sm text-sky-300">Aapki baat samajh raha hoon…</p>
            )}
            {voice.error && (
              <p className="mt-3 rounded-lg bg-red-500/15 px-3 py-2 text-center text-xs text-red-300">{voice.error}</p>
            )}
            {!live.connected && !voice.error && !voice.listening && !transcribing && (
              <p className="mt-2 text-center text-xs text-white/40">
                Sabse acha: “🎙️ Live Baat” dabao — phone call jaisa, bas boliye. Ya manual mic use karo.
              </p>
            )}
          </div>

          {/* transcript */}
          <div className="glass mt-6 flex-1 rounded-2xl p-4">
            <h3 className="mb-2 text-sm uppercase tracking-widest text-white/40">Conversation</h3>
            <div className="max-h-[40vh] space-y-2 overflow-y-auto scrollbar-thin pr-1">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-xl px-3 py-2 text-sm",
                    m.role === "user" ? "ml-6 bg-sky-500/20" : "mr-6 bg-white/5"
                  )}
                >
                  <span className="mr-1 font-bold text-white/50">
                    {m.role === "user" ? "You" : settings.aiWaiterName || "Raj"}:
                  </span>
                  {m.content}
                </div>
              ))}
              {thinking && (
                <div className="mr-6 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin" /> soch raha hoon…
                </div>
              )}
              <div ref={transcriptEndRef} />
            </div>
            {/* text fallback (still voice-channel; no touch ordering) */}
            <form onSubmit={submitText} className="mt-3 flex gap-2">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="…ya yahan type karke boliye"
                className="flex-1 rounded-lg bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30"
              />
              <Button type="submit" size="sm" variant="secondary">
                Send
              </Button>
            </form>
          </div>
        </div>

        {/* right: context screen */}
        <div className="min-h-[70vh]">
          <ContextScreen
            mode={ended ? "ended" : mode}
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
