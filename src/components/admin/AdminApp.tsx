"use client";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, UtensilsCrossed, Package, Grid3x3, ListOrdered, ChefHat,
  Receipt, BarChart3, History, Bell, Settings as SettingsIcon, Mail, LogOut, Lock,
} from "lucide-react";
import { useSocket } from "@/lib/useSocket";
import { EVENTS } from "@/lib/events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DashboardSection, TablesSection, OrdersSection, BillingSection, HistorySection, KitchenMonitorSection, StaffSection } from "./sections";
import { MenuSection } from "./MenuSection";
import { ComboSection } from "./ComboSection";
import { AnalyticsSection } from "./AnalyticsSection";
import { SettingsSection, EmailSection } from "./SettingsSection";

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "menu", label: "Menu", icon: UtensilsCrossed },
  { key: "combos", label: "Combos", icon: Package },
  { key: "tables", label: "Tables", icon: Grid3x3 },
  { key: "orders", label: "Live Orders", icon: ListOrdered },
  { key: "kitchen", label: "Kitchen Monitor", icon: ChefHat },
  { key: "billing", label: "Billing & Payments", icon: Receipt },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "history", label: "Order History", icon: History },
  { key: "staff", label: "Staff Calls", icon: Bell },
  { key: "settings", label: "Settings", icon: SettingsIcon },
  { key: "email", label: "Email Reports", icon: Mail },
];

export function AdminApp() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [active, setActive] = useState("dashboard");
  const [tick, setTick] = useState(0); // bump to refresh sections

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("dinex_admin") === "1") setAuthed(true);
  }, []);

  useSocket("admin", {
    [EVENTS.ADMIN_DASHBOARD_UPDATED]: () => setTick((t) => t + 1),
    [EVENTS.STAFF_CALLED]: () => setTick((t) => t + 1),
    [EVENTS.PAYMENT_SUCCESS]: () => setTick((t) => t + 1),
  });

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    if (res.ok) {
      sessionStorage.setItem("dinex_admin", "1");
      setAuthed(true);
      setErr("");
    } else setErr("Galat PIN. Dobara try karein.");
  };

  const logout = () => {
    sessionStorage.removeItem("dinex_admin");
    setAuthed(false);
    setPin("");
  };

  if (!authed) {
    return (
      <div className="bot-bg flex min-h-screen items-center justify-center text-white">
        <form onSubmit={login} className="glass w-full max-w-sm rounded-2xl p-8">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/20">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Dinex Admin</h1>
            <p className="text-sm text-white/50">Enter PIN to continue</p>
          </div>
          <Input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="text-center text-2xl tracking-[0.5em]"
            autoFocus
          />
          {err && <p className="mt-2 text-center text-sm text-red-400">{err}</p>}
          <Button type="submit" className="mt-4 w-full" size="lg">Login</Button>
          <p className="mt-3 text-center text-xs text-white/30">Default PIN: 1234</p>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0e1a] text-white">
      {/* sidebar */}
      <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-white/10 bg-[#0c1322] p-3">
        <div className="px-3 py-4">
          <div className="text-lg font-black">🤖 Dinex Admin</div>
          <div className="text-xs text-white/40">Swad Mahal</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin">
          {NAV.map((n) => (
            <button
              key={n.key}
              onClick={() => setActive(n.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active === n.key ? "bg-primary text-primary-foreground" : "text-white/70 hover:bg-white/5"
              )}
            >
              <n.icon className="h-4 w-4" /> {n.label}
            </button>
          ))}
        </nav>
        <Button variant="ghost" onClick={logout} className="mt-2 justify-start text-white/60">
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </aside>

      {/* content */}
      <main className="flex-1 overflow-y-auto p-6">
        {active === "dashboard" && <DashboardSection tick={tick} onOpenTables={() => setActive("tables")} />}
        {active === "menu" && <MenuSection />}
        {active === "combos" && <ComboSection />}
        {active === "tables" && <TablesSection tick={tick} />}
        {active === "orders" && <OrdersSection tick={tick} />}
        {active === "kitchen" && <KitchenMonitorSection tick={tick} />}
        {active === "billing" && <BillingSection tick={tick} />}
        {active === "analytics" && <AnalyticsSection tick={tick} />}
        {active === "history" && <HistorySection />}
        {active === "staff" && <StaffSection tick={tick} />}
        {active === "settings" && <SettingsSection />}
        {active === "email" && <EmailSection />}
      </main>
    </div>
  );
}
