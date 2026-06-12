"use client";
import { Badge } from "@/components/ui/badge";
import { cn, formatMoney } from "@/lib/utils";

function VegDot({ veg }: { veg: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded-sm border",
        veg ? "border-green-600" : "border-red-600"
      )}
      title={veg ? "Veg" : "Non-veg"}
    >
      <span className={cn("h-2 w-2 rounded-full", veg ? "bg-green-600" : "bg-red-600")} />
    </span>
  );
}

export function DishCard({ dish, index }: { dish: any; index: number }) {
  return (
    <div className="dinex-card overflow-hidden rounded-2xl animate-fade-in">
      <div className="relative h-36 w-full bg-[#f1ece3]">
        {dish.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dish.photoUrl} alt={dish.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">{dish.emoji}</div>
        )}
        <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-[#2b2b2b] shadow">
          #{index + 1}
        </div>
        {dish.bestseller && (
          <div className="absolute right-2 top-2 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white shadow">
            ⭐ Bestseller
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <VegDot veg={dish.isVeg} />
              <span className="text-xl">{dish.emoji}</span>
            </div>
            <h3 className="mt-1 text-lg font-bold leading-tight text-[#2b2b2b]">{dish.name}</h3>
            {dish.nameHi && <p className="text-sm text-[#a89f92]">{dish.nameHi}</p>}
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold text-orange-600">{formatMoney(dish.price)}</div>
            {dish.spiceLevel > 0 && <div className="text-sm">{"🌶️".repeat(dish.spiceLevel)}</div>}
          </div>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-[#6b655c]">{dish.description}</p>
        {dish.totalOrders > 0 && (
          <p className="mt-2 text-xs text-[#a89f92]">Ordered {dish.totalOrders}× • ~{dish.prepTime} min</p>
        )}
      </div>
    </div>
  );
}

export function ComboCard({ combo, index }: { combo: any; index: number }) {
  return (
    <div className="dinex-card overflow-hidden rounded-2xl animate-fade-in">
      <div className="relative h-36 w-full bg-[#f1ece3]">
        {combo.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={combo.photoUrl} alt={combo.name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-6xl">{combo.emoji}</div>
        )}
        <div className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-[#2b2b2b] shadow">#{index + 1}</div>
        <div className="absolute right-2 top-2 rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white shadow">
          Save {formatMoney(combo.savings)}
        </div>
      </div>
      <div className="p-4">
        <h3 className="text-lg font-bold text-[#2b2b2b]">{combo.name}</h3>
        {combo.nameHi && <p className="text-sm text-[#a89f92]">{combo.nameHi}</p>}
        <p className="mt-1 text-sm text-[#6b655c]">{combo.description}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          {combo.items?.map((it: any, i: number) => (
            <span key={i} className="rounded-full bg-[#f1ece3] px-2 py-0.5 text-xs text-[#5b554c]">
              {it.emoji} {it.quantity}× {it.name}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xl font-extrabold text-orange-600">{formatMoney(combo.comboPrice)}</span>
          <span className="text-sm text-[#a89f92] line-through">{formatMoney(combo.originalPrice)}</span>
        </div>
      </div>
    </div>
  );
}

export function OrderPanel({ items, bill }: { items: any[]; bill: any }) {
  return (
    <div className="dinex-card rounded-2xl p-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-[#2b2b2b]">🧾 Your Order</h2>
      {items.length === 0 ? (
        <p className="mt-6 text-[#8b8378]">Your order is empty — just speak to add items.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((i) => (
            <div key={i.id} className="dinex-soft flex items-center justify-between rounded-xl px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{i.emoji}</span>
                <div>
                  <div className="font-semibold text-[#2b2b2b]">{i.qty}× {i.name}</div>
                  {i.specialInstructions && <div className="text-xs text-amber-600">“{i.specialInstructions}”</div>}
                  <div className="text-xs text-[#a89f92]">
                    {i.confirmed ? `Kitchen: ${i.orderStatus}` : "Awaiting confirmation"}
                    {i.etaMinutes ? ` • ETA ${i.etaMinutes} min` : ""}
                  </div>
                </div>
              </div>
              <div className="font-bold text-[#2b2b2b]">{formatMoney(i.unitPrice * i.qty)}</div>
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
    <div className={cn("mt-5 space-y-2 border-t border-black/10 pt-4", compact && "text-sm")}>
      <Row label="Subtotal" value={formatMoney(bill.subtotal, bill.currencySymbol)} />
      <Row label={`GST (${bill.gstPercent}%)`} value={formatMoney(bill.gstAmount, bill.currencySymbol)} />
      <Row label={`Service (${bill.serviceChargePercent}%)`} value={formatMoney(bill.serviceAmount, bill.currencySymbol)} />
      <div className="flex items-center justify-between border-t border-black/10 pt-2 text-xl font-extrabold text-[#2b2b2b]">
        <span>Total</span>
        <span className="text-orange-600">{formatMoney(bill.total, bill.currencySymbol)}</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[#6b655c]">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function BillPanel({ bill }: { bill: any }) {
  return (
    <div className="dinex-card rounded-2xl p-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-[#2b2b2b]">🧾 Final Bill</h2>
      {bill?.lines?.length ? (
        <div className="mt-4 space-y-2 text-[#3a352e]">
          {bill.lines.map((l: any, i: number) => (
            <div key={i} className="flex items-center justify-between">
              <span>{l.emoji} {l.qty}× {l.name}</span>
              <span>{formatMoney(l.lineTotal, bill.currencySymbol)}</span>
            </div>
          ))}
        </div>
      ) : null}
      <BillSummary bill={bill} />
      <p className="mt-4 text-center text-sm text-[#8b8378]">Say “show QR” to pay 📲</p>
    </div>
  );
}

export function PaymentPanel({ payload }: { payload: any }) {
  if (!payload) return null;
  return (
    <div className="dinex-card rounded-2xl p-6 text-center animate-fade-in">
      <h2 className="text-2xl font-bold text-[#2b2b2b]">📲 Scan & Pay</h2>
      <p className="mt-1 text-[#8b8378]">{payload.restaurantName}</p>
      {payload.qrDataUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={payload.qrDataUrl} alt="UPI QR" className="mx-auto mt-4 h-60 w-60 rounded-xl border border-black/5 bg-white p-2" />
      )}
      <div className="mt-4 text-4xl font-black text-orange-600">
        {formatMoney(payload.amount, payload.currencySymbol || "₹")}
      </div>
      <div className="mt-1 text-sm text-[#8b8378]">UPI: {payload.upiId}</div>
    </div>
  );
}

export function KitchenStatusPanel({ items }: { items: any[] }) {
  const confirmed = items.filter((i) => i.confirmed);
  const statusEmoji: Record<string, string> = { NEW: "🆕", COOKING: "🍳", READY: "✅", SERVED: "🍽️", CANCELLED: "❌" };
  return (
    <div className="dinex-card rounded-2xl p-6 animate-fade-in">
      <h2 className="text-2xl font-bold text-[#2b2b2b]">👨‍🍳 Kitchen Status</h2>
      {confirmed.length === 0 ? (
        <p className="mt-4 text-[#8b8378]">No orders sent to the kitchen yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {confirmed.map((i) => (
            <div key={i.id} className="dinex-soft flex items-center justify-between rounded-xl px-4 py-3">
              <span className="flex items-center gap-3 text-[#2b2b2b]">
                <span className="text-2xl">{i.emoji}</span>
                <span className="font-semibold">{i.qty}× {i.name}</span>
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
    <div className="dinex-card rounded-2xl p-8 text-center animate-fade-in">
      <div className="text-6xl">🙋</div>
      <h2 className="mt-4 text-2xl font-bold text-[#2b2b2b]">A staff member has been called</h2>
      <p className="mt-2 text-[#6b655c]">Someone will be at your table shortly.</p>
      {reason && <p className="mt-1 text-sm text-[#a89f92]">“{reason}”</p>}
    </div>
  );
}
