"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Bell, Volume2 } from "lucide-react";
import { useSocket } from "@/lib/useSocket";
import { useVoice } from "@/lib/useVoice";
import { EVENTS } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const URGENCY_STYLE: Record<string, string> = {
  normal: "border-white/10",
  warning: "border-amber-500/70 shadow-[0_0_0_1px_rgba(245,158,11,0.4)]",
  urgent: "border-orange-500 shadow-[0_0_0_2px_rgba(249,115,22,0.5)]",
  critical: "border-red-600 animate-flash",
};

function beep(freq = 880, ms = 220) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = freq;
    o.type = "sine";
    g.gain.value = 0.15;
    o.start();
    setTimeout(() => {
      o.stop();
      ctx.close();
    }, ms);
  } catch {}
}

export function KitchenClient() {
  const [board, setBoard] = useState<any>(null);
  const [soundOn, setSoundOn] = useState(true);
  const prevNewCount = useRef(0);
  const soundRef = useRef(true);
  soundRef.current = soundOn;

  const load = useCallback(async () => {
    const r = await fetch("/api/kitchen", { cache: "no-store" });
    const data = await r.json();
    // new-order alert
    const newCount = data?.columns?.new?.length ?? 0;
    if (newCount > prevNewCount.current && soundRef.current) {
      beep(880);
      setTimeout(() => beep(1040), 250);
    }
    prevNewCount.current = newCount;
    setBoard(data);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // refresh elapsed/urgency
    return () => clearInterval(t);
  }, [load]);

  useSocket("kitchen", {
    [EVENTS.KITCHEN_ORDER_NEW]: () => {
      if (soundRef.current) {
        beep(880);
        setTimeout(() => beep(1040), 250);
      }
      load();
    },
    [EVENTS.KITCHEN_REFRESH]: () => load(),
    [EVENTS.STAFF_CALLED]: () => {
      if (soundRef.current) beep(620, 400);
      load();
    },
    [EVENTS.PAYMENT_CASH_REQUESTED]: () => {
      if (soundRef.current) beep(520, 400);
      load();
    },
  });

  const act = useCallback(
    async (orderId: string, action: string, extra: any = {}) => {
      await fetch("/api/kitchen/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, action, ...extra }),
      });
      load();
    },
    [load]
  );

  const staffAct = async (callId: string, action: string) => {
    await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId, action }) });
    load();
  };

  const cashConfirm = async (paymentId: string) => {
    await fetch("/api/payment/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", paymentId }) });
    load();
  };

  // ---- optional kitchen voice commands: "table 5 ready", "table 3 ten minutes", "table 2 cooking start"
  const handleVoice = useCallback(
    (text: string) => {
      const t = text.toLowerCase();
      const m = t.match(/table\s*(\d+)/);
      if (!m || !board) return;
      const tableNo = parseInt(m[1], 10);
      const findOrder = (statuses: string[]) =>
        [...board.columns.new, ...board.columns.cooking, ...board.columns.ready].find(
          (o: any) => o.tableNumber === tableNo && statuses.includes(o.status)
        );
      if (t.includes("ready")) {
        const o = findOrder(["NEW", "COOKING"]);
        if (o) act(o.id, "ready");
      } else if (t.includes("cooking") || t.includes("start")) {
        const o = findOrder(["NEW"]);
        if (o) act(o.id, "start_cooking");
      } else if (t.includes("served") || t.includes("serve")) {
        const o = findOrder(["READY"]);
        if (o) act(o.id, "served");
      } else {
        const eta = t.match(/(\d+)\s*(min|minute|minit)/);
        if (eta) {
          const o = findOrder(["NEW", "COOKING"]);
          if (o) act(o.id, "set_eta", { etaMinutes: parseInt(eta[1], 10) });
        }
      }
    },
    [board, act]
  );
  const handleVoiceAudio = useCallback(
    async (blob: Blob) => {
      const fd = new FormData();
      fd.append("audio", blob, "speech.webm");
      const r = await fetch("/api/transcribe", { method: "POST", body: fd });
      const d = await r.json();
      if (d.text) handleVoice(d.text);
    },
    [handleVoice]
  );
  const voice = useVoice({ onAudio: handleVoiceAudio, useOpenAiTts: false });

  if (!board) return <div className="p-10 text-white/60">Loading kitchen…</div>;

  const stats = board.stats;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* top bar */}
      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#0a0e1a]/95 px-6 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-black">👨‍🍳 {board.settings.restaurantName} — Kitchen</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Stat label="Pending" value={stats.pending} color="text-sky-400" />
            <Stat label="Cooking" value={stats.cooking} color="text-amber-400" />
            <Stat label="Ready" value={stats.ready} color="text-green-400" />
            <Stat label="Served today" value={stats.servedToday} />
            <Stat label="Avg prep" value={`${stats.avgPrep}m`} />
            <Stat label="Hot item" value={stats.mostActive} />
            <Button size="sm" variant={soundOn ? "secondary" : "outline"} onClick={() => setSoundOn((s) => !s)}>
              <Volume2 className="h-4 w-4" /> {soundOn ? "Sound on" : "Muted"}
            </Button>
            <Button size="sm" variant={voice.listening ? "default" : "outline"} onClick={() => (voice.listening ? voice.stop() : voice.start())} disabled={!voice.supported}>
              {voice.listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} Voice
            </Button>
          </div>
        </div>
      </div>

      {/* alerts: staff + cash */}
      {(board.staffCalls.length > 0 || board.pendingCash.length > 0) && (
        <div className="space-y-2 px-6 pt-4">
          {board.staffCalls.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-amber-500/60 bg-amber-500/10 px-4 py-2 animate-fade-in">
              <span className="flex items-center gap-2 font-semibold text-amber-300">
                <Bell className="h-4 w-4" /> Table {c.tableNumber} — {c.reason} <Badge variant="warning">{c.status}</Badge>
              </span>
              <span className="flex gap-2">
                {c.status === "PENDING" && <Button size="sm" variant="secondary" onClick={() => staffAct(c.id, "ack")}>Acknowledge</Button>}
                <Button size="sm" variant="success" onClick={() => staffAct(c.id, "resolve")}>Resolve</Button>
              </span>
            </div>
          ))}
          {board.pendingCash.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-green-500/60 bg-green-500/10 px-4 py-2 animate-fade-in">
              <span className="font-semibold text-green-300">💵 Table {p.tableNumber} — Cash payment ₹{Math.round(p.amount)} pending</span>
              <Button size="sm" variant="success" onClick={() => cashConfirm(p.id)}>Confirm Cash Received</Button>
            </div>
          ))}
        </div>
      )}

      {/* columns */}
      <div className="grid gap-4 p-6 lg:grid-cols-4">
        <Column title="🆕 New Orders" count={board.columns.new.length}>
          {board.columns.new.map((o: any) => (
            <OrderCard key={o.id} o={o}>
              <Button size="sm" variant="warning" onClick={() => act(o.id, "start_cooking")}>Start Cooking</Button>
              <Button size="sm" variant="secondary" onClick={() => promptEta(o.id, act)}>Set ETA</Button>
              <Button size="sm" variant="outline" onClick={() => act(o.id, "cancel_order")}>Cancel</Button>
            </OrderCard>
          ))}
        </Column>
        <Column title="🍳 Cooking" count={board.columns.cooking.length}>
          {board.columns.cooking.map((o: any) => (
            <OrderCard key={o.id} o={o}>
              <Button size="sm" variant="success" onClick={() => act(o.id, "ready")}>Mark Ready</Button>
              <Button size="sm" variant="secondary" onClick={() => promptEta(o.id, act)}>Set ETA</Button>
              <Button size="sm" variant="outline" onClick={() => act(o.id, "delayed", { note: "Thodi der lagegi" })}>Delayed</Button>
            </OrderCard>
          ))}
        </Column>
        <Column title="✅ Ready" count={board.columns.ready.length}>
          {board.columns.ready.map((o: any) => (
            <OrderCard key={o.id} o={o}>
              <Button size="sm" variant="default" onClick={() => act(o.id, "served")}>Mark Served</Button>
            </OrderCard>
          ))}
        </Column>
        <Column title="🍽️ Served" count={board.columns.served.length}>
          {board.columns.served.slice(-12).map((o: any) => (
            <OrderCard key={o.id} o={o} dim />
          ))}
        </Column>
      </div>
    </div>
  );
}

function promptEta(orderId: string, act: (id: string, a: string, e?: any) => void) {
  const v = window.prompt("ETA in minutes?", "10");
  if (v) act(orderId, "set_eta", { etaMinutes: parseInt(v, 10) || 10 });
}

function Stat({ label, value, color }: { label: string; value: any; color?: string }) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-1">
      <span className="text-xs text-white/40">{label}: </span>
      <span className={cn("font-bold", color)}>{value}</span>
    </div>
  );
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white/[0.03] p-3">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold">{title}</h2>
        <Badge variant="secondary">{count}</Badge>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function OrderCard({ o, children, dim }: { o: any; children?: React.ReactNode; dim?: boolean }) {
  return (
    <div className={cn("rounded-xl border-2 bg-[#0e1426] p-4 animate-fade-in", URGENCY_STYLE[o.urgency], dim && "opacity-50")}>
      <div className="flex items-center justify-between">
        <span className="text-lg font-black">Table {o.tableNumber}</span>
        <span className="text-xs text-white/40">{new Date(o.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-white/40">
        <span>#{o.id.slice(-5)}</span>
        <span>• {o.elapsedMinutes} min ago</span>
        {o.etaMinutes ? <Badge variant="warning" className="ml-auto">ETA {o.etaMinutes}m</Badge> : null}
      </div>
      <div className="mt-3 space-y-1">
        {o.items.map((it: any) => (
          <div key={it.id} className={cn("flex items-center gap-2", it.status === "CANCELLED" && "line-through opacity-50")}>
            <span className={cn("inline-block h-3 w-3 rounded-sm border", it.isVeg ? "border-green-500" : "border-red-500")}>
              <span className={cn("block h-full w-full scale-50 rounded-full", it.isVeg ? "bg-green-500" : "bg-red-500")} />
            </span>
            <span className="font-semibold">{it.qty}×</span>
            <span>{it.emoji} {it.name}</span>
            {it.isCombo && <Badge variant="secondary" className="text-[10px]">combo</Badge>}
            {it.specialInstructions && <span className="text-xs text-amber-400">“{it.specialInstructions}”</span>}
          </div>
        ))}
      </div>
      {o.kitchenNote && <p className="mt-2 text-xs text-sky-300">📝 {o.kitchenNote}</p>}
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
