"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";

const COLORS = ["#f97316", "#38bdf8", "#22c55e", "#a855f7", "#eab308", "#ef4444", "#14b8a6", "#f472b6"];

export function AnalyticsSection({ tick }: { tick: number }) {
  const [d, setD] = useState<any>(null);
  useEffect(() => {
    fetch("/api/admin/data?section=analytics", { cache: "no-store" }).then((r) => r.json()).then(setD);
  }, [tick]);
  if (!d) return <div className="p-8 text-white/40">Loading analytics…</div>;
  const sym = d.currencySymbol;

  return (
    <div>
      <h1 className="mb-5 text-2xl font-black">Analytics</h1>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <KPI label="Avg Order Value" value={formatMoney(d.avgOrderValue, sym)} />
        <KPI label="Avg Session" value={`${d.avgSessionMin}m`} />
        <KPI label="Avg Prep Time" value={`${d.avgPrep}m`} />
        <KPI label="7-Day Revenue" value={formatMoney(d.days.reduce((s: number, x: any) => s + x.revenue, 0), sym)} />
        <KPI label="7-Day Orders" value={d.days.reduce((s: number, x: any) => s + x.orders, 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Revenue (last 7 days)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={d.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={tipStyle} />
              <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Orders (last 7 days)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.days}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={(v) => v.slice(5)} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="orders" fill="#38bdf8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Best-selling items">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.bestSelling} layout="vertical" margin={{ left: 30 }}>
              <XAxis type="number" stroke="#64748b" fontSize={11} />
              <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={90} />
              <Tooltip contentStyle={tipStyle} />
              <Bar dataKey="orders" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Payment method breakdown">
          {d.paymentBreakdown.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={d.paymentBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                  {d.paymentBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip contentStyle={tipStyle} />
              </PieChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Panel>
        <Panel title="Cuisine performance">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={d.cuisine}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="name" stroke="#64748b" fontSize={10} /><YAxis stroke="#64748b" fontSize={11} /><Tooltip contentStyle={tipStyle} /><Bar dataKey="orders" fill="#a855f7" radius={[4, 4, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Peak hours">
          {d.peakHours.length ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={d.peakHours}><CartesianGrid strokeDasharray="3 3" stroke="#1e293b" /><XAxis dataKey="hour" stroke="#64748b" fontSize={10} /><YAxis stroke="#64748b" fontSize={11} /><Tooltip contentStyle={tipStyle} /><Bar dataKey="orders" fill="#eab308" radius={[4, 4, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          ) : <Empty />}
        </Panel>
      </div>

      <Panel title="Item performance" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-white/40"><tr><th className="p-2">Item</th><th className="p-2">Today</th><th className="p-2">Total</th><th className="p-2">Revenue</th><th className="p-2">Last ordered</th></tr></thead>
            <tbody>
              {d.itemTable.map((i: any) => (
                <tr key={i.name} className="border-t border-white/5"><td className="p-2">{i.name}</td><td className="p-2">{i.todayOrders}</td><td className="p-2">{i.totalOrders}</td><td className="p-2">{formatMoney(i.revenue, sym)}</td><td className="p-2 text-white/40">{new Date(i.lastOrdered).toLocaleDateString("en-IN")}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

const tipStyle = { background: "#0e1426", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 };
function KPI({ label, value }: any) { return <Card className="border-white/10 bg-[#0e1426]"><CardContent className="p-4"><div className="text-xs text-white/40">{label}</div><div className="text-2xl font-black">{value}</div></CardContent></Card>; }
function Panel({ title, children, className }: any) { return <div className={`rounded-xl border border-white/10 bg-[#0e1426] p-4 ${className || ""}`}><h3 className="mb-3 font-bold">{title}</h3>{children}</div>; }
function Empty() { return <div className="flex h-[240px] items-center justify-center text-white/30">No data yet</div>; }
