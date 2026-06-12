// Custom Next.js server with an attached Socket.IO instance.
// Supports HTTP (localhost dev) and HTTPS (for mobile/LAN — mic/WebRTC need a
// secure context on non-localhost origins). Set HTTPS=1 + HOST=0.0.0.0 for mobile.

import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { networkInterfaces } from "os";
import next from "next";
import { Server as IOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);
const useHttps = process.env.HTTPS === "1";
// Cloud platforms (Render/Railway/Fly) need 0.0.0.0; local dev uses localhost.
const hostname = process.env.HOST || (useHttps || !dev ? "0.0.0.0" : "localhost");

const ROOMS = { KITCHEN: "kitchen", ADMIN: "admin", table: (t: string | number) => `table:${t}` };

function lanIPs(): string[] {
  const out: string[] = [];
  const ifaces = networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

async function makeCert(ips: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const selfsigned = require("selfsigned");
  const altNames: any[] = [
    { type: 2, value: "localhost" },
    { type: 7, ip: "127.0.0.1" },
    ...ips.map((ip) => ({ type: 7, ip })),
  ];
  // selfsigned v5: generate() is async and resolves to { private, public, cert }
  const pems = await selfsigned.generate([{ name: "commonName", value: "localhost" }], {
    days: 365,
    keySize: 2048,
    algorithm: "sha256",
    extensions: [{ name: "subjectAltName", altNames }],
  });
  return { key: pems.private, cert: pems.cert };
}

const app = next({ dev, hostname: hostname === "0.0.0.0" ? "localhost" : hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  const ips = lanIPs();
  const httpServer = useHttps
    ? createHttpsServer(await makeCert(ips), (req, res) => handle(req, res))
    : createHttpServer((req, res) => handle(req, res));

  const io = new IOServer(httpServer, { cors: { origin: "*" }, path: "/socket.io" });
  (globalThis as any).__dinexIo = io;

  io.on("connection", (socket) => {
    const { role, table } = socket.handshake.query as { role?: string; table?: string };
    if (role === "kitchen") socket.join(ROOMS.KITCHEN);
    if (role === "admin") socket.join(ROOMS.ADMIN);
    if (role === "table" && table) socket.join(ROOMS.table(table));

    socket.on("join", (payload: { role?: string; table?: string | number }) => {
      if (payload?.role === "kitchen") socket.join(ROOMS.KITCHEN);
      if (payload?.role === "admin") socket.join(ROOMS.ADMIN);
      if (payload?.role === "table" && payload.table !== undefined) socket.join(ROOMS.table(payload.table));
    });

    socket.on("relay", ({ event, payload, room }: { event: string; payload: unknown; room?: string }) => {
      if (room) io.to(room).emit(event, payload);
      else socket.broadcast.emit(event, payload);
    });
  });

  httpServer.listen(port, hostname, () => {
    const scheme = useHttps ? "https" : "http";
    console.log(`\n🤖 Dinex Bot running (${scheme})`);
    console.log(`   • Local:   ${scheme}://localhost:${port}`);
    if (useHttps && ips.length) {
      console.log(`\n   📱 On your phone (same Wi-Fi), open:`);
      for (const ip of ips) console.log(`      ${scheme}://${ip}:${port}/bot/table/1`);
      console.log(`\n   ⚠️  Phone will warn "Not secure" → tap Advanced → Proceed. Then allow the mic.`);
    } else if (!useHttps) {
      console.log(`   • Bot:     ${scheme}://localhost:${port}/bot/table/1`);
      console.log(`   • Kitchen: ${scheme}://localhost:${port}/kitchen`);
      console.log(`   • Admin:   ${scheme}://localhost:${port}/admin  (PIN 1234)`);
    }
    console.log("");
  });
});
