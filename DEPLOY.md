# Deploying Dinex Bot (permanent hosting)

This app uses a **custom Node server** (Next.js + Socket.IO) + **SQLite**, so it needs a
host that runs a long-lived container with a **persistent disk** and **WebSockets** —
i.e. Render, Railway, Fly.io, or a VPS. (Vercel/Netlify won't work without a big refactor,
because they're serverless and don't support the custom WebSocket server or SQLite files.)

A `Dockerfile` + `render.yaml` are included.

---

## Option A — Render (easiest, recommended)

1. Push this folder to a **GitHub repo** (see "Push to GitHub" below).
2. Go to https://render.com → **New → Blueprint** → connect your repo (it reads `render.yaml`).
3. When prompted, set the secret **`OPENAI_API_KEY`** = your key.
4. Click **Apply**. Render builds the Docker image, attaches a 1 GB disk at `/data`
   (SQLite lives there), and gives you a permanent HTTPS URL like
   `https://dinex-bot.onrender.com`.
5. Open `https://<your-app>.onrender.com/bot/table/1` — mic + realtime voice work
   (it's real HTTPS).

> The `starter` plan ($7/mo) is always-on and includes the disk. The free plan sleeps after
> inactivity and has **no persistent disk**, so use starter for a real deployment.

## Option B — Railway

1. Push to GitHub.
2. https://railway.app → **New Project → Deploy from GitHub repo**.
3. Railway auto-detects the `Dockerfile`. Add a **Volume** mounted at `/data`.
4. Add variables: `OPENAI_API_KEY`, `DATABASE_URL=file:/data/dev.db`,
   `OPENAI_REALTIME_MODEL=gpt-realtime`, `HOST=0.0.0.0`.
5. Deploy → you get a public HTTPS URL.

## Option C — Any VPS (Docker)

```bash
docker build -t dinex-bot .
docker run -d -p 80:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e OPENAI_REALTIME_MODEL=gpt-realtime \
  -v dinex-data:/data \
  --name dinex dinex-bot
```
Put it behind a reverse proxy (Caddy/Nginx) with HTTPS so the mic works.

---

## Push to GitHub

```bash
git init
git add -A
git commit -m "Dinex Bot"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

---

## Notes
- **HTTPS is required** for the microphone / realtime voice on any non-localhost URL.
  All the hosts above give you HTTPS automatically.
- Set `OPENAI_API_KEY` as a secret on the host — never commit it.
- First boot runs `prisma db push` + seeds the menu only if the DB is empty
  (`npm run start:cloud`), so redeploys keep your data.
