import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const settings = await getSettings();
  const tableCount = settings.numberOfTables;

  return (
    <main className="bot-bg min-h-screen text-white">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <div className="text-center">
          <div className="mx-auto mb-6 h-24 w-24 rounded-full raj-orb animate-raj-pulse" />
          <h1 className="text-5xl font-black tracking-tight">Dinex Bot</h1>
          <p className="mt-3 text-lg text-white/70">
            Voice-first AI waiter for <span className="text-primary font-semibold">{settings.restaurantName}</span>
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          <Link href="/bot/table/1" className="glass rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="text-4xl">🤖</div>
            <h2 className="mt-3 text-xl font-bold">Customer Bot</h2>
            <p className="mt-1 text-sm text-white/60">Talk to {settings.aiWaiterName}. Voice ordering at the table.</p>
            <p className="mt-3 text-xs text-primary">Open Table 1 →</p>
          </Link>

          <Link href="/kitchen" className="glass rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="text-4xl">👨‍🍳</div>
            <h2 className="mt-3 text-xl font-bold">Kitchen Display</h2>
            <p className="mt-1 text-sm text-white/60">Live orders, cooking, ready & served — with alerts.</p>
            <p className="mt-3 text-xs text-primary">Open kitchen →</p>
          </Link>

          <Link href="/admin" className="glass rounded-2xl p-6 hover:bg-white/10 transition-colors">
            <div className="text-4xl">📊</div>
            <h2 className="mt-3 text-xl font-bold">Admin Dashboard</h2>
            <p className="mt-1 text-sm text-white/60">Menu, combos, tables, billing, analytics & more.</p>
            <p className="mt-3 text-xs text-primary">Open admin (PIN {settings.adminPin}) →</p>
          </Link>
        </div>

        <div className="mt-12">
          <h3 className="text-sm uppercase tracking-widest text-white/40">Quick table access</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {Array.from({ length: tableCount }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={`/bot/table/${n}`}
                className="glass rounded-lg px-4 py-2 text-sm hover:bg-white/10 transition-colors"
              >
                Table {n}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
