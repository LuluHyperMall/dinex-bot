"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

function useSettings() {
  const [s, setS] = useState<any>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { fetch("/api/settings").then((r) => r.json()).then((d) => setS(d.settings)); }, []);
  const save = async () => {
    const r = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    setMsg((await r.json()).ok ? "Saved ✓" : "Failed");
    setTimeout(() => setMsg(""), 2000);
  };
  return { s, setS, save, msg };
}

export function SettingsSection() {
  const { s, setS, save, msg } = useSettings();
  if (!s) return <div className="p-8 text-white/40">Loading…</div>;
  const F = (key: string, label: string, type = "text") => (
    <div><Label className="mb-1 block">{label}</Label><Input type={type} value={s[key] ?? ""} onChange={(e) => setS({ ...s, [key]: e.target.value })} /></div>
  );
  return (
    <div className="max-w-3xl">
      <div className="mb-5 flex items-center justify-between"><h1 className="text-2xl font-black">Settings</h1><div className="flex items-center gap-3"><span className="text-sm text-green-400">{msg}</span><Button onClick={save}>Save</Button></div></div>
      <div className="space-y-6">
        <Group title="Restaurant">
          {F("restaurantName", "Restaurant name")}
          {F("logoText", "Logo text")}
          {F("adminPin", "Admin PIN")}
          {F("currency", "Currency code")}
          {F("currencySymbol", "Currency symbol")}
          {F("numberOfTables", "Number of tables", "number")}
        </Group>
        <Group title="Billing">
          {F("gstPercent", "GST %", "number")}
          {F("serviceChargePercent", "Service charge %", "number")}
          {F("upiId", "UPI ID")}
        </Group>
        <Group title="AI Waiter">
          {F("aiWaiterName", "AI waiter name")}
          {F("languagePreference", "Language preference")}
          {F("aiHumorLevel", "Humor level (0-10)", "number")}
        </Group>
        <Group title="Kitchen urgency (minutes)">
          {F("urgencyWarningMin", "Warning after", "number")}
          {F("urgencyUrgentMin", "Urgent after", "number")}
          {F("urgencyCriticalMin", "Critical after", "number")}
        </Group>
      </div>
    </div>
  );
}

export function EmailSection() {
  const { s, setS, save, msg } = useSettings();
  const [test, setTest] = useState("");
  const [report, setReport] = useState("");
  if (!s) return <div className="p-8 text-white/40">Loading…</div>;
  const sendTest = async () => { setTest("Sending…"); const r = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test" }) }); setTest((await r.json()).message); };
  const sendReport = async () => { setReport("Sending…"); const r = await fetch("/api/email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "report" }) }); setReport((await r.json()).message); };
  return (
    <div className="max-w-2xl">
      <div className="mb-5 flex items-center justify-between"><h1 className="text-2xl font-black">Email Reports</h1><div className="flex items-center gap-3"><span className="text-sm text-green-400">{msg}</span><Button onClick={save}>Save SMTP</Button></div></div>
      <div className="space-y-4 rounded-xl border border-white/10 bg-[#0e1426] p-5">
        <div><Label className="mb-1 block">Gmail address</Label><Input value={s.emailAddress} onChange={(e) => setS({ ...s, emailAddress: e.target.value })} placeholder="restaurant@gmail.com" /></div>
        <div><Label className="mb-1 block">Gmail app password</Label><Input type="password" value={s.gmailAppPassword} onChange={(e) => setS({ ...s, gmailAppPassword: e.target.value })} placeholder="xxxx xxxx xxxx xxxx" /></div>
        <label className="flex items-center gap-2"><Switch checked={s.emailReportsEnabled} onCheckedChange={(v) => setS({ ...s, emailReportsEnabled: v })} /> Send bill email after payment</label>
        <p className="text-xs text-white/40">Uses a Gmail App Password (not your normal password). Enable 2FA on the Gmail account and generate one at myaccount.google.com → Security → App passwords.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <div><Button variant="secondary" onClick={sendTest}>Send test email</Button>{test && <span className="ml-2 text-sm text-white/60">{test}</span>}</div>
      </div>
      <div className="mt-3"><Button variant="secondary" onClick={sendReport}>Send end-of-day report now</Button>{report && <span className="ml-2 text-sm text-white/60">{report}</span>}</div>
    </div>
  );
}

function Group({ title, children }: any) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0e1426] p-5">
      <h3 className="mb-3 font-bold">{title}</h3>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  );
}
