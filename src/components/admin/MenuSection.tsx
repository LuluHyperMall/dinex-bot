"use client";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/utils";

const empty = {
  id: "", nameEn: "", nameHi: "", category: "Main Course", cuisineType: "North Indian",
  price: 0, isVeg: true, description: "", prepTimeMinutes: 15, photoUrl: "", emoji: "🍽️",
  available: true, spiceLevel: 0, tags: "", bestseller: false, recommended: false,
};

export function MenuSection() {
  const [items, setItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [fCat, setFCat] = useState("");
  const [fCuisine, setFCuisine] = useState("");
  const [fVeg, setFVeg] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [bulkValue, setBulkValue] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (fCat) params.set("category", fCat);
    if (fCuisine) params.set("cuisine", fCuisine);
    if (fVeg) params.set("veg", fVeg);
    const r = await fetch(`/api/menu?${params}`, { cache: "no-store" });
    const d = await r.json();
    setItems(d.items);
    setCategories(d.categories);
    setCuisines(d.cuisines);
  }, [q, fCat, fCuisine, fVeg]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    const method = editing.id ? "PATCH" : "POST";
    await fetch("/api/menu", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing) });
    setEditing(null);
    load();
  };
  const patch = async (id: string, data: any) => {
    await fetch("/api/menu", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    load();
  };
  const del = async (id: string) => {
    if (!confirm("Delete this item?")) return;
    await fetch(`/api/menu?id=${id}`, { method: "DELETE" });
    load();
  };
  const bulk = async (action: string, value: any) => {
    await fetch("/api/menu/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, value }) });
    load();
  };

  const previewCsv = async () => {
    const r = await fetch("/api/menu/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: csvText, preview: true }) });
    const d = await r.json();
    setCsvPreview(d.preview || []);
  };
  const importCsv = async () => {
    await fetch("/api/menu/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: csvText }) });
    setCsvOpen(false);
    setCsvText("");
    setCsvPreview(null);
    load();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div><h1 className="text-2xl font-black">Menu Management</h1><p className="text-sm text-white/50">{items.length} items</p></div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/menu/sample" className="inline-flex"><Button size="sm" variant="ghost">Sample CSV</Button></a>
          <Button size="sm" variant="secondary" onClick={() => setCsvOpen(true)}>Upload CSV</Button>
          <Button size="sm" onClick={() => setEditing({ ...empty })}>+ Add Item</Button>
        </div>
      </div>

      {/* filters + bulk */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="w-44" />
        <Select value={fCat} onChange={(e) => setFCat(e.target.value)} className="w-40"><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select value={fCuisine} onChange={(e) => setFCuisine(e.target.value)} className="w-40"><option value="">All cuisines</option>{cuisines.map((c) => <option key={c}>{c}</option>)}</Select>
        <Select value={fVeg} onChange={(e) => setFVeg(e.target.value)} className="w-32"><option value="">Veg + Non-veg</option><option value="true">Veg only</option><option value="false">Non-veg only</option></Select>
        <div className="ml-auto flex items-center gap-2">
          <Input placeholder="Bulk: +/-% price" value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="w-32" />
          <Button size="sm" variant="outline" onClick={() => bulk("adjustPrice", Number(bulkValue) || 0)}>Apply %</Button>
          <Button size="sm" variant="outline" onClick={() => bulk("setAvailable", true)}>Enable all</Button>
          <Button size="sm" variant="outline" onClick={() => bulk("setAvailable", false)}>Disable all</Button>
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-sm">
          <thead className="bg-white/5 text-left text-white/50">
            <tr><th className="p-2">Item</th><th className="p-2">Cat</th><th className="p-2">Cuisine</th><th className="p-2">Price</th><th className="p-2">Veg</th><th className="p-2">Orders</th><th className="p-2">Available</th><th className="p-2">Flags</th><th className="p-2"></th></tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-white/5">
                <td className="p-2"><span className="mr-1">{i.emoji}</span>{i.nameEn} <span className="text-white/30">{i.nameHi}</span></td>
                <td className="p-2 text-white/60">{i.category}</td>
                <td className="p-2 text-white/60">{i.cuisineType}</td>
                <td className="p-2">{formatMoney(i.price)}</td>
                <td className="p-2">{i.isVeg ? <Badge variant="veg">veg</Badge> : <Badge variant="nonveg">non</Badge>}</td>
                <td className="p-2 text-white/60">{i.totalOrders}</td>
                <td className="p-2"><Switch checked={i.available} onCheckedChange={(v) => patch(i.id, { available: v })} /></td>
                <td className="p-2">
                  <div className="flex gap-1">
                    <button title="Bestseller" onClick={() => patch(i.id, { bestseller: !i.bestseller })} className={i.bestseller ? "" : "opacity-30"}>⭐</button>
                    <button title="Recommended" onClick={() => patch(i.id, { recommended: !i.recommended })} className={i.recommended ? "" : "opacity-30"}>👍</button>
                    <button title="Out of stock" onClick={() => patch(i.id, { outOfStock: !i.outOfStock })} className={i.outOfStock ? "text-red-400" : "opacity-30"}>🚫</button>
                  </div>
                </td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setEditing({ ...i })}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => del(i.id)} className="text-red-400">Del</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit Item" : "Add Item"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="English name"><Input value={editing.nameEn} onChange={(e) => setEditing({ ...editing, nameEn: e.target.value })} /></Field>
              <Field label="Hindi name"><Input value={editing.nameHi} onChange={(e) => setEditing({ ...editing, nameHi: e.target.value })} /></Field>
              <Field label="Category"><Input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></Field>
              <Field label="Cuisine"><Input value={editing.cuisineType} onChange={(e) => setEditing({ ...editing, cuisineType: e.target.value })} /></Field>
              <Field label="Price"><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} /></Field>
              <Field label="Prep time (min)"><Input type="number" value={editing.prepTimeMinutes} onChange={(e) => setEditing({ ...editing, prepTimeMinutes: e.target.value })} /></Field>
              <Field label="Emoji"><Input value={editing.emoji} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} /></Field>
              <Field label="Spice (0-3)"><Input type="number" value={editing.spiceLevel} onChange={(e) => setEditing({ ...editing, spiceLevel: e.target.value })} /></Field>
              <Field label="Photo URL" full><Input value={editing.photoUrl} onChange={(e) => setEditing({ ...editing, photoUrl: e.target.value })} /></Field>
              <Field label="Tags (comma)" full><Input value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} /></Field>
              <Field label="Description" full><Textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
              <div className="col-span-2 flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><Switch checked={editing.isVeg} onCheckedChange={(v) => setEditing({ ...editing, isVeg: v })} /> Veg</label>
                <label className="flex items-center gap-2"><Switch checked={editing.available} onCheckedChange={(v) => setEditing({ ...editing, available: v })} /> Available</label>
                <label className="flex items-center gap-2"><Switch checked={editing.bestseller} onCheckedChange={(v) => setEditing({ ...editing, bestseller: v })} /> Bestseller</label>
                <label className="flex items-center gap-2"><Switch checked={editing.recommended} onCheckedChange={(v) => setEditing({ ...editing, recommended: v })} /> Recommended</label>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                <Button onClick={save}>Save</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* CSV dialog */}
      <Dialog open={csvOpen} onOpenChange={(o) => { setCsvOpen(o); if (!o) setCsvPreview(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Import Menu CSV</DialogTitle></DialogHeader>
          <input type="file" accept=".csv" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsvText(await f.text()); }} className="text-sm" />
          <Textarea placeholder="…or paste CSV here" value={csvText} onChange={(e) => setCsvText(e.target.value)} className="min-h-[120px] font-mono text-xs" />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={previewCsv}>Preview</Button>
            <Button onClick={importCsv} disabled={!csvText}>Import</Button>
          </div>
          {csvPreview && (
            <div className="max-h-60 overflow-y-auto rounded-lg border border-white/10 text-xs">
              <table className="w-full"><thead className="bg-white/5"><tr><th className="p-1 text-left">Name</th><th className="p-1">Price</th><th className="p-1">Veg</th><th className="p-1">Cat</th></tr></thead>
                <tbody>{csvPreview.map((p, i) => <tr key={i} className="border-t border-white/5"><td className="p-1">{p.emoji} {p.nameEn}</td><td className="p-1 text-center">{p.price}</td><td className="p-1 text-center">{p.isVeg ? "✓" : "✗"}</td><td className="p-1 text-center">{p.category}</td></tr>)}</tbody>
              </table>
              <p className="p-2 text-white/40">{csvPreview.length} valid rows ready to import.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
