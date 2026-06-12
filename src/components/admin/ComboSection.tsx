"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/utils";

const emptyCombo = { id: "", nameEn: "", nameHi: "", description: "", category: "Combo", emoji: "🍱", photoUrl: "", comboPrice: 0, active: true, items: [] as any[] };

export function ComboSection() {
  const [combos, setCombos] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([fetch("/api/combo", { cache: "no-store" }), fetch("/api/menu", { cache: "no-store" })]);
    setCombos((await c.json()).combos);
    setMenu((await m.json()).items);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openEdit = (combo: any) => {
    setEditing({
      ...combo,
      items: combo.items.map((ci: any) => ({ menuItemId: ci.menuItemId, quantity: ci.quantity })),
    });
  };

  const save = async () => {
    const method = editing.id ? "PATCH" : "POST";
    await fetch("/api/combo", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
    setEditing(null);
    load();
  };
  const toggle = async (id: string, active: boolean) => {
    await fetch("/api/combo", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active }) });
    load();
  };
  const del = async (id: string) => { if (confirm("Delete combo?")) { await fetch(`/api/combo?id=${id}`, { method: "DELETE" }); load(); } };

  const toggleItem = (menuItemId: string) => {
    const items = [...editing.items];
    const idx = items.findIndex((i) => i.menuItemId === menuItemId);
    if (idx >= 0) items.splice(idx, 1);
    else items.push({ menuItemId, quantity: 1 });
    setEditing({ ...editing, items });
  };
  const setQty = (menuItemId: string, qty: number) => {
    setEditing({ ...editing, items: editing.items.map((i: any) => (i.menuItemId === menuItemId ? { ...i, quantity: qty } : i)) });
  };
  const original = editing ? editing.items.reduce((s: number, it: any) => { const m = menu.find((x) => x.id === it.menuItemId); return s + (m ? m.price * it.quantity : 0); }, 0) : 0;

  return (
    <div>
      <div className="mb-5 flex items-end justify-between">
        <div><h1 className="text-2xl font-black">Combo Management</h1><p className="text-sm text-white/50">{combos.length} combos</p></div>
        <Button size="sm" onClick={() => setEditing({ ...emptyCombo })}>+ Add Combo</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {combos.map((c) => (
          <div key={c.id} className="rounded-xl border border-white/10 bg-[#0e1426] p-4">
            <div className="flex items-start justify-between">
              <div><div className="text-lg font-bold">{c.emoji} {c.nameEn}</div><div className="text-sm text-white/50">{c.nameHi}</div></div>
              <Switch checked={c.active} onCheckedChange={(v) => toggle(c.id, v)} />
            </div>
            <p className="mt-1 text-sm text-white/60">{c.description}</p>
            <div className="mt-2 flex flex-wrap gap-1">{c.items.map((ci: any, i: number) => <Badge key={i} variant="secondary" className="text-xs">{ci.quantity}× {ci.menuItem?.nameEn}</Badge>)}</div>
            <div className="mt-3 flex items-center gap-2">
              <span className="text-lg font-extrabold text-primary">{formatMoney(c.comboPrice)}</span>
              <span className="text-sm text-white/40 line-through">{formatMoney(c.originalPrice)}</span>
              <Badge variant="success">Save {formatMoney(c.savings)}</Badge>
            </div>
            <div className="mt-2 text-xs text-white/40">Ordered {c.totalOrders}×</div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Edit</Button>
              <Button size="sm" variant="ghost" className="text-red-400" onClick={() => del(c.id)}>Delete</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Combo" : "Add Combo"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>English name</Label><Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} /></div>
                <div><Label>Hindi name</Label><Input value={editing.nameHi} onChange={(e) => setEditing({ ...editing, nameHi: e.target.value })} /></div>
                <div><Label>Category</Label><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
                <div><Label>Emoji</Label><Input value={editing.emoji} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} /></div>
                <div className="col-span-2"><Label>Photo URL</Label><Input value={editing.photoUrl} onChange={(e) => setEditing({ ...editing, photoUrl: e.target.value })} /></div>
                <div className="col-span-2"><Label>Description</Label><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
              </div>
              <div>
                <Label>Select items</Label>
                <div className="mt-1 max-h-44 overflow-y-auto rounded-lg border border-white/10 p-2 scrollbar-thin">
                  {menu.map((m) => {
                    const sel = editing.items.find((i: any) => i.menuItemId === m.id);
                    return (
                      <div key={m.id} className="flex items-center justify-between py-1 text-sm">
                        <label className="flex items-center gap-2"><input type="checkbox" checked={!!sel} onChange={() => toggleItem(m.id)} /> {m.emoji} {m.nameEn} <span className="text-white/40">{formatMoney(m.price)}</span></label>
                        {sel && <Input type="number" value={sel.quantity} onChange={(e) => setQty(m.id, Number(e.target.value) || 1)} className="h-7 w-16" />}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div><Label>Combo price</Label><Input type="number" value={editing.comboPrice} onChange={(e) => setEditing({ ...editing, comboPrice: e.target.value })} className="w-32" /></div>
                <div className="text-sm text-white/60">Original: <b>{formatMoney(original)}</b> • Savings: <b className="text-green-400">{formatMoney(Math.max(0, original - Number(editing.comboPrice)))}</b></div>
              </div>
              <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={save} disabled={!editing.nameEn || editing.items.length === 0}>Save</Button></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
