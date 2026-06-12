"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/utils";
import { toCSV } from "@/lib/csv";

function useSection<T = any>(section: string, tick: number, query = "") {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/data?section=${section}${query}`, { cache: "no-store" });
    setData(await r.json());
    setLoading(false);
  }, [section, query]);
  useEffect(() => {
    reload();
  }, [reload, tick]);
  return { data, loading, reload };
}

function SectionTitle({ title, desc, children }: any) {
  return (
    <div className="mb-5 flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-black">{title}</h1>
        {desc && <p className="text-sm text-white/50">{desc}</p>}
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  FREE: "bg-white/5 text-white/40",
  ACTIVE: "bg-sky-500/20 text-sky-300",
  ORDERED: "bg-indigo-500/20 text-indigo-300",
  COOKING: "bg-amber-500/20 text-amber-300",
  READY: "bg-green-500/20 text-green-300",
  BILLING: "bg-purple-500/20 text-purple-300",
  PAID: "bg-white/10 text-white/50",
  INCOMPLETE: "bg-red-500/20 text-red-300",
};

// ---------------- Dashboard ----------------
export function DashboardSection({ tick, onOpenTables }: { tick: number; onOpenTables: () => void }) {
  const { data } = useSection<any>("dashboard", tick);
  if (!data) return <Loading />;
  const c = data.cards;
  const cards = [
    { label: "Today Revenue", value: formatMoney(c.revenue, c.currencySymbol) },
    { label: "Today Orders", value: c.orders },
    { label: "Active Tables", value: c.activeTables },
    { label: "Billing Tables", value: c.billingTables },
    { label: "Free Tables", value: c.freeTables },
    { label: "Avg Order Value", value: formatMoney(c.avgOrderValue, c.currencySymbol) },
    { label: "Most Ordered", value: c.mostOrdered },
    { label: "Pending Kitchen", value: c.pendingKitchen },
    { label: "Payments Today", value: c.paymentsToday },
  ];
  return (
    <div>
      <SectionTitle title="Dashboard" desc="Realtime overview" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((k) => (
          <Card key={k.label} className="bg-[#0e1426] border-white/10">
            <CardContent className="p-4">
              <div className="text-xs text-white/40">{k.label}</div>
              <div className="mt-1 text-2xl font-black">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="mb-3 font-bold">Live Tables</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {data.grid.map((t: any) => (
              <button
                key={t.tableNumber}
                onClick={onOpenTables}
                className={`rounded-xl p-3 text-left ${STATUS_COLOR[t.status] || "bg-white/5"}`}
              >
                <div className="text-lg font-black">T{t.tableNumber}</div>
                <div className="text-xs">{t.status}</div>
                {t.bill > 0 && <div className="mt-1 text-xs">{formatMoney(t.bill)}</div>}
                {t.durationMin > 0 && <div className="text-[10px] text-white/40">{t.durationMin}m</div>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-bold">Recent Activity</h2>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-thin">
            {data.activity.map((a: any) => (
              <div key={a.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/80">{a.message}</span>
                </div>
                <div className="text-[10px] text-white/30">
                  {a.type} • {new Date(a.createdAt).toLocaleTimeString("en-IN")}
                </div>
              </div>
            ))}
            {data.activity.length === 0 && <p className="text-white/40 text-sm">No activity yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Tables ----------------
export function TablesSection({ tick }: { tick: number }) {
  const { data, reload } = useSection<any>("tables", tick);
  const action = async (body: any) => {
    await fetch("/api/table", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    reload();
  };
  if (!data) return <Loading />;
  return (
    <div>
      <SectionTitle title="Table Management" desc="Sessions, statuses & manual control" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {data.grid.map((t: any) => (
          <Card key={t.tableNumber} className="border-white/10 bg-[#0e1426]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xl font-black">Table {t.tableNumber}</span>
                <Badge className={STATUS_COLOR[t.status]}>{t.status}</Badge>
              </div>
              <div className="mt-2 text-sm text-white/60">
                {t.itemCount} items • {formatMoney(t.bill)}
                {t.durationMin > 0 && <span> • {t.durationMin}m</span>}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {t.status === "FREE" ? (
                  <Button size="sm" onClick={() => action({ action: "start", tableNumber: t.tableNumber })}>Start session</Button>
                ) : (
                  <>
                    <Button size="sm" variant="outline" onClick={() => action({ action: "free", sessionId: t.sessionId })}>Free / close</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const to = window.prompt("Move to table #?");
                        if (to) action({ action: "move", sessionId: t.sessionId, toTable: Number(to) });
                      }}
                    >
                      Move
                    </Button>
                    <a className="text-xs text-primary underline self-center" href={`/bot/table/${t.tableNumber}`} target="_blank">View bot</a>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------- Live Orders ----------------
export function OrdersSection({ tick }: { tick: number }) {
  const { data, reload } = useSection<any>("orders", tick);
  const [filterTable, setFilterTable] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const kAct = async (orderId: string, action: string, extra: any = {}) => {
    await fetch("/api/kitchen/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, action, ...extra }) });
    reload();
  };
  if (!data) return <Loading />;
  let orders = data.orders as any[];
  if (filterTable) orders = orders.filter((o) => String(o.tableNumber) === filterTable);
  if (filterStatus) orders = orders.filter((o) => o.status === filterStatus);
  return (
    <div>
      <SectionTitle title="Live Orders" desc="All in-progress orders">
        <Input placeholder="Table #" value={filterTable} onChange={(e) => setFilterTable(e.target.value)} className="w-24" />
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-36">
          <option value="">All status</option>
          <option value="NEW">New</option>
          <option value="COOKING">Cooking</option>
          <option value="READY">Ready</option>
        </Select>
      </SectionTitle>
      <div className="space-y-3">
        {orders.map((o) => (
          <Card key={o.id} className="border-white/10 bg-[#0e1426]">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-black">Table {o.tableNumber}</span>
                  <Badge className={STATUS_COLOR[o.status]}>{o.status}</Badge>
                  {o.etaMinutes ? <Badge variant="warning">ETA {o.etaMinutes}m</Badge> : null}
                  <span className="text-xs text-white/40">{o.elapsedMinutes}m ago</span>
                </div>
                <div className="mt-1 text-sm text-white/70">{o.items.map((i: any) => `${i.qty}× ${i.name}`).join(", ")}</div>
                {o.specialNote && <div className="text-xs text-amber-400">Note: {o.specialNote}</div>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="success" onClick={() => kAct(o.id, "served")}>Force served</Button>
                <Button size="sm" variant="outline" onClick={() => kAct(o.id, "cancel_order")}>Cancel</Button>
                <Button size="sm" variant="secondary" onClick={() => { const n = window.prompt("Note to kitchen:"); if (n) kAct(o.id, "add_note", { note: n }); }}>Kitchen note</Button>
                <Button size="sm" variant="ghost" onClick={async () => { const m = window.prompt("Message to table (Raj will say it):"); if (m) await fetch("/api/admin/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tableNumber: o.tableNumber, message: m }) }); }}>Message table</Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && <p className="text-white/40">No live orders.</p>}
      </div>
    </div>
  );
}

// ---------------- Kitchen Monitor (read-only) ----------------
export function KitchenMonitorSection({ tick }: { tick: number }) {
  const { data } = useSection<any>("kitchen", tick);
  if (!data) return <Loading />;
  const cols = [
    { k: "new", label: "New", color: "text-sky-400" },
    { k: "cooking", label: "Cooking", color: "text-amber-400" },
    { k: "ready", label: "Ready", color: "text-green-400" },
  ];
  const delayed = [...data.columns.new, ...data.columns.cooking].filter((o: any) => o.urgency === "urgent" || o.urgency === "critical");
  return (
    <div>
      <SectionTitle title="Kitchen Monitor" desc="Read-only view of the kitchen" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cols.map((c) => (
          <Card key={c.k} className="border-white/10 bg-[#0e1426]"><CardContent className="p-4"><div className="text-xs text-white/40">{c.label}</div><div className={`text-3xl font-black ${c.color}`}>{data.columns[c.k].length}</div></CardContent></Card>
        ))}
        <Card className="border-white/10 bg-[#0e1426]"><CardContent className="p-4"><div className="text-xs text-white/40">Avg prep</div><div className="text-3xl font-black">{data.stats.avgPrep}m</div></CardContent></Card>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 font-bold text-red-400">⚠️ Delayed / Bottleneck</h2>
          {delayed.length ? delayed.map((o: any) => (
            <div key={o.id} className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm">
              Table {o.tableNumber} — {o.elapsedMinutes}m — {o.items.map((i: any) => i.name).join(", ")}
            </div>
          )) : <p className="text-white/40 text-sm">No delays. 🎉</p>}
        </div>
        <div>
          <h2 className="mb-2 font-bold">🔥 Most active item</h2>
          <div className="rounded-lg bg-white/5 px-3 py-2">{data.stats.mostActive}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------- Billing ----------------
export function BillingSection({ tick }: { tick: number }) {
  const { data, reload } = useSection<any>("billing", tick);
  if (!data) return <Loading />;
  const confirmCash = async (paymentId: string) => {
    await fetch("/api/payment/cash", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", paymentId }) });
    reload();
  };
  return (
    <div>
      <SectionTitle title="Billing & Payments" desc="Active bills, payments & method breakdown" />
      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(data.breakdown).map(([m, v]: any) => (
          <Card key={m} className="border-white/10 bg-[#0e1426]"><CardContent className="p-4"><div className="text-xs text-white/40">{m}</div><div className="text-xl font-black">{formatMoney(v.amount, data.currencySymbol)}</div><div className="text-xs text-white/40">{v.count} payments</div></CardContent></Card>
        ))}
      </div>

      <h2 className="mb-2 mt-6 font-bold">Active Bills</h2>
      <div className="space-y-2">
        {data.activeBills.map((b: any) => (
          <div key={b.sessionId} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2">
            <span>Table {b.tableNumber} <Badge className={STATUS_COLOR[b.status]}>{b.status}</Badge></span>
            <span className="font-bold">{formatMoney(b.total, data.currencySymbol)}</span>
          </div>
        ))}
        {data.activeBills.length === 0 && <p className="text-white/40 text-sm">No active bills.</p>}
      </div>

      <h2 className="mb-2 mt-6 font-bold">Payments</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-white/40">
            <tr><th className="p-2">Table</th><th className="p-2">Method</th><th className="p-2">Amount</th><th className="p-2">Status</th><th className="p-2">Ref</th><th className="p-2">Time</th><th></th></tr>
          </thead>
          <tbody>
            {data.payments.map((p: any) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="p-2">T{p.tableNumber}</td>
                <td className="p-2">{p.method}</td>
                <td className="p-2">{formatMoney(p.amount, data.currencySymbol)}</td>
                <td className="p-2"><Badge variant={p.status === "SUCCESS" ? "success" : p.status === "PENDING" ? "warning" : "destructive"}>{p.status}</Badge></td>
                <td className="p-2 text-white/40">{p.reference}</td>
                <td className="p-2 text-white/40">{new Date(p.createdAt).toLocaleTimeString("en-IN")}</td>
                <td className="p-2">{p.status === "PENDING" && p.method === "CASH" && <Button size="sm" variant="success" onClick={() => confirmCash(p.id)}>Confirm</Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.payments.length === 0 && <p className="text-white/40 text-sm mt-2">No payments yet.</p>}
      </div>
    </div>
  );
}

// ---------------- History ----------------
export function HistorySection() {
  const [date, setDate] = useState("");
  const [table, setTable] = useState("");
  const [method, setMethod] = useState("");
  const [q, setQ] = useState("");
  const query = `${date ? `&date=${date}` : ""}${table ? `&table=${table}` : ""}${method ? `&method=${method}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const { data } = useSection<any>("history", 0, query);
  const rows = data?.rows || [];
  const exportCsv = () => {
    const csv = toCSV(
      rows.map((r: any) => ({ table: r.tableNumber, start: new Date(r.startTime).toLocaleString(), end: r.endTime ? new Date(r.endTime).toLocaleString() : "", duration: r.durationMin, items: r.items.join("; "), subtotal: r.subtotal, gst: r.gst, service: r.service, total: r.total, method: r.method, status: r.status })),
      ["table", "start", "end", "duration", "items", "subtotal", "gst", "service", "total", "method", "status"]
    );
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dinex-order-history.csv";
    a.click();
  };
  return (
    <div>
      <SectionTitle title="Order History" desc="Completed sessions">
        <Button size="sm" variant="secondary" onClick={exportCsv}>Export CSV</Button>
      </SectionTitle>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        <Input placeholder="Table #" value={table} onChange={(e) => setTable(e.target.value)} className="w-24" />
        <Select value={method} onChange={(e) => setMethod(e.target.value)} className="w-32"><option value="">All methods</option><option>UPI</option><option>CARD</option><option>CASH</option><option>WALLET</option></Select>
        <Input placeholder="Search item/note" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-white/40"><tr><th className="p-2">Table</th><th className="p-2">Start</th><th className="p-2">Dur</th><th className="p-2">Items</th><th className="p-2">Total</th><th className="p-2">Method</th></tr></thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.sessionId} className="border-t border-white/5 align-top">
                <td className="p-2">T{r.tableNumber}</td>
                <td className="p-2 text-white/50">{new Date(r.startTime).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="p-2">{r.durationMin}m</td>
                <td className="p-2 max-w-xs text-white/70">{r.items.join(", ")}</td>
                <td className="p-2 font-bold">{formatMoney(r.total)}</td>
                <td className="p-2">{r.method}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="text-white/40 text-sm mt-2">No completed sessions match.</p>}
      </div>
    </div>
  );
}

// ---------------- Staff Calls ----------------
export function StaffSection({ tick }: { tick: number }) {
  const [calls, setCalls] = useState<any[]>([]);
  const load = useCallback(async () => {
    const r = await fetch("/api/staff", { cache: "no-store" });
    setCalls((await r.json()).calls || []);
  }, []);
  useEffect(() => { load(); }, [load, tick]);
  const act = async (callId: string, action: string) => {
    await fetch("/api/staff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ callId, action }) });
    load();
  };
  const pending = calls.filter((c) => c.status !== "RESOLVED");
  return (
    <div>
      <SectionTitle title="Staff Calls" desc="Customer assistance requests" />
      <h2 className="mb-2 font-bold">Pending ({pending.length})</h2>
      <div className="space-y-2">
        {pending.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2">
            <span>🙋 Table {c.tableNumber} — {c.reason} <Badge variant="warning">{c.status}</Badge> <span className="text-xs text-white/40">{new Date(c.createdAt).toLocaleTimeString("en-IN")}</span></span>
            <span className="flex gap-2">
              {c.status === "PENDING" && <Button size="sm" variant="secondary" onClick={() => act(c.id, "ack")}>Acknowledge</Button>}
              <Button size="sm" variant="success" onClick={() => act(c.id, "resolve")}>Resolve</Button>
            </span>
          </div>
        ))}
        {pending.length === 0 && <p className="text-white/40 text-sm">No pending calls.</p>}
      </div>
    </div>
  );
}

function Loading() {
  return <div className="p-8 text-white/40">Loading…</div>;
}
