# 🤖 Dinex Bot — Voice-First AI Restaurant Waiter

A complete, locally-runnable MVP of **Dinex Bot**: a tabletop AI waiter ("Raj") that
takes orders **by voice**, shows dish/combo visuals, sends orders to a live kitchen
display, tracks a running bill, and handles demo payments — plus a full admin dashboard.

Built with **Next.js 15 · TypeScript · Tailwind · Prisma/SQLite · Socket.IO · OpenAI GPT-4o · Recharts · Nodemailer**.

---

## ✨ What's inside

| Surface | URL | What it does |
|---|---|---|
| 🤖 Customer Bot | `/bot/table/[tableId]` | Voice-only ordering with Raj. Animated face, live transcript, dish/combo photo cards, order summary, kitchen status, bill, UPI QR. |
| 👨‍🍳 Kitchen Display | `/kitchen` | New → Cooking → Ready → Served columns, urgency colors, sound + visual alerts, staff/cash alerts, optional voice commands. |
| 📊 Admin Dashboard | `/admin` (PIN `1234`) | 12 sections: Dashboard, Menu, Combos, Tables, Live Orders, Kitchen Monitor, Billing, Analytics, History, Staff Calls, Settings, Email. |

Everything is wired with **realtime Socket.IO** — no manual refresh.

---

## 🚀 Quick start

```bash
# 1. Install (already done if node_modules exists)
npm install

# 2. Create the SQLite DB + seed Swad Mahal (20 items, 5 combos)
npm run setup        # = prisma generate + db push + seed

# 3. Run (custom server = Next.js + Socket.IO together)
npm run dev
```

Then open:
- **http://localhost:3000** — landing page with links to every surface
- **http://localhost:3000/bot/table/1** — customer bot (allow microphone)
- **http://localhost:3000/kitchen** — kitchen display
- **http://localhost:3000/admin** — admin (PIN `1234`)

> Tip: open the bot, kitchen, and admin in three browser tabs/windows to see realtime sync live.

---

## 🔊 Voice & AI

The bot uses the browser's **SpeechRecognition** (mic) + **SpeechSynthesis** (Raj's voice),
tuned for Hinglish (`hi-IN`). Use **Chrome/Edge** for best mic support. There's also a
text box on the bot screen to "talk" to Raj by typing (handy if the mic isn't available).

**Raj's brain** has two modes:
- **GPT-4o (recommended)** — real tool-calling. Add your key (below).
- **Local fallback** — a deterministic Hinglish intent engine that calls the *same*
  server tools. Works fully offline; just a bit simpler than GPT-4o.

### Enable GPT-4o + Realtime voice

Create `.env.local` (copy from `.env.local.example`):

```bash
DATABASE_URL="file:./dev.db"
OPENAI_API_KEY="sk-..."            # <-- your key
OPENAI_MODEL="gpt-4o"
OPENAI_REALTIME_MODEL="gpt-4o-realtime-preview"
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
```

Restart `npm run dev`. The bot screen shows `brain: gpt-4o` in the top bar when active.
With no key it shows `brain: local`. An ephemeral Realtime token endpoint is available at
`POST /api/realtime/session` for voice-to-voice upgrades.

---

## 🍽️ Demo script (the full 23-step flow)

1. Admin opens `/admin`, logs in with PIN `1234`, browses Menu/Combos.
2. Customer opens `/bot/table/1`; Raj greets by voice.
3. Say **"kuch spicy chicken dikhao"** → dish cards appear on screen.
4. Say **"pehla wala add karo"** → Raj confirms price, adds it; bill updates live.
5. Say **"ek garlic naan add karo"** → added.
6. Say **"haan order confirm karo"** → order flies to `/kitchen` (New column, with a sound alert).
7. In the kitchen: **Start Cooking → Set ETA → Mark Ready → Mark Served**. The bot screen
   reflects each step in realtime ("khaana ready hai! 🔔").
8. Say **"bill lao"** → screen switches to the itemized bill (subtotal + GST + service).
9. Say **"QR dikhao"** → UPI QR + amount appears.
10. Tap a demo payment method (UPI/Card/Wallet succeed instantly; **Cash** waits for the
    kitchen/admin to confirm). Session closes, table frees, analytics update.
11. Say **"staff bulao"** any time → kitchen + admin get a staff-call alert.

---

## 🧠 Architecture

```
server.ts                 Custom Next.js server + Socket.IO (shared process)
prisma/schema.prisma      12 models (SQLite). Enums are TS unions (src/lib/enums.ts)
prisma/seed.ts            Swad Mahal + 20 items + 5 combos

src/lib/
  tools.ts                The 21 AI tools (getMenuItems … updateSessionPreferences)
  aiTools.ts              OpenAI tool schemas + Raj's system prompt
  fallbackBrain.ts        Offline Hinglish intent engine (same tools)
  billing.ts              Subtotal + GST% + service% = total
  realtime.ts / events.ts Socket.IO emit helpers + canonical event names
  kitchen.ts / admin.ts   Kitchen board + admin aggregations
  session.ts analytics.ts email.ts

src/app/api/              chat, session, kitchen, staff, payment, menu, combo,
                          settings, table, email, admin/* route handlers
src/components/
  bot/                    BotClient, RajFace, dish/combo/order/bill/QR panels
  kitchen/KitchenClient   Columns + alerts + voice
  admin/                  AdminApp + 12 sections (+ Recharts analytics)
```

The AI **never invents menu data** — it always calls server tools, which read/write the DB
and broadcast realtime events that drive the screens.

---

## 🧾 Billing

`Total = Subtotal + (Subtotal × GST%) + (Subtotal × Service%)`. GST% and Service% are
configurable in **Admin → Settings** (default 5% + 5%).

## 📧 Email reports (optional)

In **Admin → Email Reports**, add a Gmail address + **App Password** (not your normal
password — generate at *Google Account → Security → App passwords* with 2FA on). Toggle
"Send bill email after payment", use **Send test email** to verify, or **Send end-of-day report**.

## 🛠️ Useful scripts

```bash
npm run dev        # dev (Next + Socket.IO, hot reload)
npm run setup      # generate client + create DB + seed
npm run db:reset   # wipe + reseed (fresh demo data)
npm run seed       # reseed menu/combos only
npm run build      # production build
npm run start      # production server
```

## ⚠️ Notes
- Dish photos use `loremflickr.com` (random matching food images); each item also has a
  guaranteed emoji fallback. Swap `photoUrl`s in Admin → Menu for real photos.
- SQLite + a custom server means this runs locally with zero external infra. For
  multi-instance deploys you'd move Socket.IO to a shared adapter and SQLite to Postgres.
```
