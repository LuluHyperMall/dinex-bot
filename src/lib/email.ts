import nodemailer from "nodemailer";
import { getSettings } from "./settings";
import { formatMoney } from "./utils";

function buildTransport(email: string, appPassword: string) {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: email, pass: appPassword },
  });
}

/** Send a test email to verify SMTP settings. */
export async function sendTestEmail(): Promise<{ ok: boolean; message: string }> {
  const s = await getSettings();
  if (!s.emailAddress || !s.gmailAppPassword) {
    return { ok: false, message: "Email address / Gmail app password not configured in Settings." };
  }
  try {
    const t = buildTransport(s.emailAddress, s.gmailAppPassword);
    await t.sendMail({
      from: `${s.restaurantName} <${s.emailAddress}>`,
      to: s.emailAddress,
      subject: `✅ ${s.restaurantName} — Dinex Bot test email`,
      text: `This is a test email from your Dinex Bot system. SMTP is working!`,
    });
    return { ok: true, message: `Test email sent to ${s.emailAddress}.` };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Failed to send." };
  }
}

type BillEmail = {
  to: string;
  tableNumber: number;
  sessionTime: string;
  lines: { name: string; qty: number; lineTotal: number }[];
  subtotal: number;
  gstAmount: number;
  serviceAmount: number;
  total: number;
  method: string;
  paidAt: string;
};

/** Send an itemized bill email after payment (if enabled + configured). */
export async function sendBillEmail(data: BillEmail): Promise<{ ok: boolean; message: string }> {
  const s = await getSettings();
  if (!s.emailReportsEnabled) return { ok: false, message: "Email reports disabled." };
  if (!s.emailAddress || !s.gmailAppPassword) return { ok: false, message: "SMTP not configured." };
  if (!data.to) return { ok: false, message: "No recipient." };

  const sym = s.currencySymbol;
  const rows = data.lines
    .map((l) => `<tr><td>${l.qty}× ${l.name}</td><td align="right">${formatMoney(l.lineTotal, sym)}</td></tr>`)
    .join("");

  const html = `
  <div style="font-family:system-ui,Arial;max-width:520px;margin:auto">
    <h2 style="color:#f97316">${s.restaurantName}</h2>
    <p>Table ${data.tableNumber} • ${data.sessionTime}</p>
    <table width="100%" cellpadding="6" style="border-collapse:collapse">
      ${rows}
      <tr><td>Subtotal</td><td align="right">${formatMoney(data.subtotal, sym)}</td></tr>
      <tr><td>GST (${s.gstPercent}%)</td><td align="right">${formatMoney(data.gstAmount, sym)}</td></tr>
      <tr><td>Service (${s.serviceChargePercent}%)</td><td align="right">${formatMoney(data.serviceAmount, sym)}</td></tr>
      <tr style="font-weight:bold;border-top:2px solid #eee"><td>Total</td><td align="right">${formatMoney(data.total, sym)}</td></tr>
    </table>
    <p>Paid via <b>${data.method}</b> at ${data.paidAt}</p>
    <p style="color:#888">Thank you for dining with us! 🙏</p>
  </div>`;

  try {
    const t = buildTransport(s.emailAddress, s.gmailAppPassword);
    await t.sendMail({
      from: `${s.restaurantName} <${s.emailAddress}>`,
      to: data.to,
      subject: `🧾 ${s.restaurantName} — Bill for Table ${data.tableNumber}`,
      html,
    });
    return { ok: true, message: "Bill emailed." };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Failed to send bill." };
  }
}

/** End-of-day summary email. */
export async function sendDayReport(summary: { date: string; revenue: number; orders: number; sessions: number; topItem: string }) {
  const s = await getSettings();
  if (!s.emailAddress || !s.gmailAppPassword) return { ok: false, message: "SMTP not configured." };
  const sym = s.currencySymbol;
  const html = `
  <div style="font-family:system-ui,Arial;max-width:520px;margin:auto">
    <h2 style="color:#f97316">${s.restaurantName} — Daily Report</h2>
    <p>${summary.date}</p>
    <ul>
      <li>Revenue: <b>${formatMoney(summary.revenue, sym)}</b></li>
      <li>Orders: <b>${summary.orders}</b></li>
      <li>Sessions: <b>${summary.sessions}</b></li>
      <li>Top item: <b>${summary.topItem}</b></li>
    </ul>
  </div>`;
  try {
    const t = buildTransport(s.emailAddress, s.gmailAppPassword);
    await t.sendMail({ from: `${s.restaurantName} <${s.emailAddress}>`, to: s.emailAddress, subject: `📊 ${s.restaurantName} — Daily Report ${summary.date}`, html });
    return { ok: true, message: "Report sent." };
  } catch (e: any) {
    return { ok: false, message: e?.message || "Failed." };
  }
}
