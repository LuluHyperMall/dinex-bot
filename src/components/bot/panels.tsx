"use client";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";

function VegDot({ veg }: { veg: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded-sm border",
        veg ? "border-green-500" : "border-red-500"
      )}
      title={veg ? "Veg" : "Non-veg"}
    >
      <span className={cn("h-2 w-2 rounded-full", veg ? "bg-green-500" : "bg-red-500")} />
    </span>
  );
}

export function DishCard({ dish, index }: { dish: any; index: number }) {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-fade-in">
      <div className="relative h-40 w-full bg-white/5">
        {dish.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dish.photoUrl} alt={dish.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">{dish.emoji}</div>
        )}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-1 text-xs font-bold">
          #{index + 1}
        </div>
        {dish.bestseller && (
          <div className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-black">
            ⭐ Bestseller
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <VegDot veg={dish.isVeg} />
              <span className="text-2xl">{dish.emoji}</span>
            </div>
            <h3 className="mt-1 text-lg font-bold leading-tight">{dish.name}</h3>
            {dish.nameHi && <p className="text-sm text-white/50">{dish.nameHi}</p>}
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold text-primary">{formatMoney(dish.price)}</div>
            {dish.spiceLevel > 0 && <div className="text-sm">{"🌶️".repeat(dish.spiceLevel)}</div>}
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-white/60">{dish.description}</p>
        {dish.totalOrders > 0 && (
          <p className="mt-2 text-xs text-white/40">Ordered {dish.totalOrders}× • ~{dish.prepTime} min</p>
        )}
      </div>
    </div>
  );
}

export function ComboCard({ combo, index }: { combo: any; index: number }) {
  return (
    <div className="glass rounded-2xl overflow-hidden animate-fade-in">
      <div className="relative h-40 w-full bg-white/5">
        {combo.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={combo.photoUrl} alt={combo.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">{combo.emoji}</div>
        )}
        <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs font-bold">#{index + 1}</div>
        <div className="absolute right-2 top-2 rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold">
          Save {formatMoney(combo.savings)}
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold">{combo.name}</h3>
        {combo.nameHi && <p className="text-sm text-white/50">{combo.nameHi}</p>}
        <p className="mt-1 text-sm text-white/60">{combo.description}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {combo.items?.map((it: any, i: number) => (
            <Badge key={i} variant="secondary" className="text-xs">
              {it.emoji} {it.quantity}× {it.name}
            </Badge>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xl font-extrabold text-primary">{formatMoney(combo.comboPrice)}</span>
          <span className="text-sm text-white/40 line-through">{formatMoney(combo.originalPrice)}</span>
        </div>
      </div>
    </div>
  );
}

export function OrderPanel({ items, bill }: { items: any[]; bill: any }) {
  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      <h2 className="text-2xl font-bold">🧾 Aapka Order</h2>
      {items.length === 0 ? (
        <p className="mt-6 text-white/50">Order abhi khaali hai. Raj se kuch mangwayein!</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{i.emoji}</span>
                <div>
                  <div className="font-semibold">
                    {i.qty}× {i.name}
                  </div>
                  {i.specialInstructions && <div className="text-xs text-amber-400">“{i.specialInstructions}”</div>}
                  <div className="text-xs text-white/40">
                    {i.confirmed ? `Kitchen: ${i.orderStatus}` : "Pending confirm"}
                    {i.etaMinutes ? ` • ETA ${i.etaMinutes} min` : ""}
                  </div>
                </div>
              </div>
              <div className="font-bold">{formatMoney(i.unitPrice * i.qty)}</div>
            </div>
          ))}
        </div>
      )}
      {bill && <BillSummary bill={bill} compact />}
    </div>
  );
}

export function BillSummary({ bill, compact }: { bill: any; compact?: boolean }) {
  if (!bill) return null;
  return (
    <div className={cn("mt-5 border-t border-white/10 pt-4 space-y-2", compact && "text-sm")}>
      <Row label="Subtotal" value={formatMoney(bill.subtotal, bill.currencySymbol)} />
      <Row label={`GST (${bill.gstPercent}%)`} value={formatMoney(bill.gstAmount, bill.currencySymbol)} />
      <Row label={`Service (${bill.serviceChargePercent}%)`} value={formatMoney(bill.serviceAmount, bill.currencySymbol)} />
      <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xl font-extrabold">
        <span>Total</span>
        <span className="text-primary">{formatMoney(bill.total, bill.currencySymbol)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-white/70">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function BillPanel({ bill }: { bill: any }) {
  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      <h2 className="text-2xl font-bold">🧾 Final Bill</h2>
      {bill?.lines?.length ? (
        <div className="mt-4 space-y-2">
          {bill.lines.map((l: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span>
                {l.emoji} {l.qty}× {l.name}
              </span>
              <span>{formatMoney(l.lineTotal, bill.currencySymbol)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <BillSummary bill={bill} />
      <p className="mt-4 text-center text-sm text-white/50">Payment ke liye boliye “QR dikhao” 📲</p>
    </div>
  );
}

export function PaymentPanel({ payload, onPaid }: { payload: any; onPaid?: (method: string) => void }) {
  if (!payload) return null;
  return (
    <div className="glass rounded-2xl p-6 text-center animate-fade-in">
      <h2 className="text-2xl font-bold">📲 Scan & Pay</h2>
      <p className="mt-1 text-white/60">{payload.restaurantName}</p>
      {payload.qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={payload.qrDataUrl} alt="UPI QR" className="mx-auto mt-4 h-64 w-64 rounded-xl bg-white p-2" />
      )}
      <div className="mt-4 text-4xl font-black text-primary">
        {formatMoney(payload.amount, payload.currencySymbol || "₹")}
      </div>
      <div className="mt-1 text-sm text-white/50">UPI: {payload.upiId}</div>
    </div>
  );
}

export function KitchenStatusPanel({ items }: { items: any[] }) {
  const confirmed = items.filter((i) => i.confirmed);
  const statusEmoji: Record<string, string> = {
    NEW: "🆕",
    COOKING: "🍳",
    READY: "✅",
    SERVED: "🍽️",
    CANCELLED: "❌",
  };
  return (
    <div className="glass rounded-2xl p-6 animate-fade-in">
      <h2 className="text-2xl font-bold">👨‍🍳 Kitchen Status</h2>
      {confirmed.length === 0 ? (
        <p className="mt-4 text-white/50">Abhi koi order kitchen mein nahi gaya.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {confirmed.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-3">
              <span className="flex items-center gap-3">
                <span className="text-2xl">{i.emoji}</span>
                <span className="font-semibold">
                  {i.qty}× {i.name}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {i.etaMinutes ? <Badge variant="warning">ETA {i.etaMinutes}m</Badge> : null}
                <Badge variant={i.orderStatus === "READY" ? "success" : "secondary"}>
                  {statusEmoji[i.orderStatus] || ""} {i.orderStatus}
                </Badge>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StaffPanel({ reason }: { reason?: string }) {
  return (
    <div className="glass rounded-2xl p-8 text-center animate-fade-in">
      <div className="text-6xl">🙋</div>
      <h2 className="mt-4 text-2xl font-bold">Staff bula liya gaya hai</h2>
      <p className="mt-2 text-white/60">Koi staff member abhi aapke table par aa raha hai.</p>
      {reason && <p className="mt-1 text-sm text-white/40">“{reason}”</p>}
    </div>
  );
}
