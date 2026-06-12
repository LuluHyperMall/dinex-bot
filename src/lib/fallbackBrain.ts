// Deterministic local "Raj" used when no OpenAI key is configured (or as a
// safety net). Parses Hinglish intent and calls the same server tools so the
// whole flow works offline. Not as smart as GPT-4o, but fully functional.

import * as T from "./tools";
import type { ToolContext } from "./tools";

type Reply = { reply: string; toolCalls: { name: string; result: any }[]; lastShownIds?: string[] };

const ordinals: Record<string, number> = {
  pehla: 0, pehle: 0, first: 0, "1": 0,
  dusra: 1, dusre: 1, second: 1, "2": 1,
  teesra: 2, teesre: 2, third: 2, "3": 2,
  chautha: 3, fourth: 3, "4": 3,
};

function has(text: string, ...words: string[]) {
  return words.some((w) => text.includes(w));
}

// Rotating attach-sell lines (vary by item index so it isn't repetitive).
const UPSELLS = [
  "Iske saath ek garlic naan? Perfect jodi banegi! 🫓",
  "Thandi sweet lassi mangwa lein? Khaane ke saath maza aa jayega. 🥛",
  "Ek combo le lein toh ₹100+ bach jaayega — bataun? 🍱",
  "Meetha bhi soch lijiye — gulab jamun ya brownie? 🍮",
  "Thoda jeera rice add kar dun? Gravy ke saath top rahega. 🍚",
  "Aaj ka bestseller bhi try karein? Log baar baar mangte hain! ⭐",
];
function upsell(seed: number): string {
  return UPSELLS[Math.abs(seed) % UPSELLS.length];
}

export async function fallbackRespond(
  userText: string,
  ctx: ToolContext,
  lastShownIds: string[] = []
): Promise<Reply> {
  const t = userText.toLowerCase().trim();
  const calls: { name: string; result: any }[] = [];
  const run = async (name: string, args: any = {}) => {
    const result = await T.runTool(name, args, ctx);
    calls.push({ name, result });
    return result;
  };

  // staff
  if (has(t, "staff", "waiter bula", "bula", "madad", "help me", "insaan")) {
    const r = await run("callStaff", { reason: "Customer requested staff" });
    return { reply: "Bilkul ji, staff ko bula raha hoon — abhi koi aata hai. 🙋", toolCalls: calls };
  }

  // bill / payment
  if (has(t, "qr", "scan", "upi") || (has(t, "pay", "payment") && has(t, "qr"))) {
    const r: any = await run("showPaymentQR", {});
    return { reply: `Ye lijiye QR — ₹${Math.round(r.amount || 0)} ka payment scan karke kar dijiye. 📲`, toolCalls: calls };
  }
  if (has(t, "bill", "kitna hua", "kitna hain", "check please", "payment karna", "total")) {
    const r: any = await run("requestBill", {});
    const total = r?.bill?.total ?? 0;
    const sweet = total > 0 ? "Akhri baar meetha ya thanda drink? Warna " : "";
    return { reply: `${sweet}aapka total ₹${Math.round(total)} hua hai ji. Payment ke liye 'QR dikhao' bol dijiye. 🧾`, toolCalls: calls };
  }

  // read order
  if (has(t, "mera order", "order batao", "kya order", "order kya")) {
    const r: any = await run("getCurrentOrder", {});
    if (!r.items?.length) return { reply: "Abhi tak order mein kuch nahi hai ji. Kuch mangwayein? 😊", toolCalls: calls };
    const list = r.items.map((i: any) => `${i.qty}× ${i.name}`).join(", ");
    return { reply: `Aapke order mein hai: ${list}. Total ₹${Math.round(r.bill?.total || 0)}.`, toolCalls: calls };
  }

  // confirm / send to kitchen
  if (has(t, "confirm", "bhej do", "order kar do", "pakka", "haan kar do", "place order", "send to kitchen", "kitchen bhej")) {
    const r: any = await run("confirmOrder", {});
    if (r.ok) return { reply: "Zaroor ji! Order kitchen mein bhej diya — taiyaari shuru. 👨‍🍳", toolCalls: calls };
    return { reply: "Order mein abhi kuch naya nahi hai add karne ke liye. Pehle kuch choose karein? 😊", toolCalls: calls };
  }

  // combos
  if (has(t, "combo", "deal", "thali", "bachat", "saving", "offer")) {
    const r: any = await run("getAvailableCombos", {});
    const ids = (r.combos || []).slice(0, 5).map((c: any) => c.id);
    await run("showComboCards", { comboIds: ids, title: "Combo Deals" });
    return { reply: "Ye dekhiye humare combos — kaafi bachat ho jaati hai! Screen pe dikha raha hoon. 🍱", toolCalls: calls, lastShownIds: ids };
  }

  // positional add: "pehla wala add karo"
  if (has(t, "add", "lelo", "le lo", "karo", "kar do", "chahiye", "mangwa", "order")) {
    // ordinal reference to last shown cards
    for (const key of Object.keys(ordinals)) {
      if (t.includes(key) && (has(t, "wala", "wali", "add", "karo", "lelo", "chahiye"))) {
        const idx = ordinals[key];
        if (lastShownIds[idx]) {
          const r: any = await run("addItemToOrder", { itemId: lastShownIds[idx], quantity: qtyFrom(t) });
          if (r.ok) return { reply: `Zabardast choice! ${r.added.name} add kar diya — ₹${r.added.unitPrice}. ${upsell(idx)}`, toolCalls: calls, lastShownIds };
        }
      }
    }
    // by name
    const r: any = await run("addItemToOrder", { name: cleanName(userText), quantity: qtyFrom(t) });
    if (r.ok) return { reply: `Bilkul ji! ${r.added.name} add kar diya — ₹${r.added.unitPrice}. ${upsell(r.added.name.length)}`, toolCalls: calls, lastShownIds };
    // fallback to search if not found
    const s: any = await run("searchMenuItems", { query: cleanName(userText) });
    const ids = (s.items || []).slice(0, 6).map((i: any) => i.id);
    if (ids.length) {
      await run("showDishCards", { itemIds: ids, title: "Aapke liye" });
      return { reply: "Ye options dekhiye screen pe — konsa add karun? 👀", toolCalls: calls, lastShownIds: ids };
    }
    return { reply: "Maaf kijiye, wo item nahi mila. Kuch aur try karein? 🙏", toolCalls: calls };
  }

  // recommend / show
  if (has(t, "dikhao", "recommend", "suggest", "kya hai", "spicy", "chicken", "paneer", "veg", "non veg", "dessert", "meetha", "drink", "biryani", "chinese", "naan", "rice", "dosa")) {
    if (has(t, "best", "popular", "famous", "mashoor")) {
      const r: any = await run("getBestSellers", { limit: 5 });
      const ids = (r.items || []).map((i: any) => i.id);
      await run("showDishCards", { itemIds: ids, title: "Aaj ke Best Sellers" });
      return { reply: "Ye humare sabse zyada bikne wale dishes hain — screen pe dekhiye! ⭐", toolCalls: calls, lastShownIds: ids };
    }
    const query = cleanName(userText);
    const vegOnly = has(t, "veg") && !has(t, "non veg", "nonveg", "non-veg");
    const r: any = await run("searchMenuItems", { query: query || "popular", vegOnly });
    let ids = (r.items || []).slice(0, 6).map((i: any) => i.id);
    if (!ids.length) {
      const b: any = await run("getBestSellers", { limit: 5 });
      ids = (b.items || []).map((i: any) => i.id);
    }
    await run("showDishCards", { itemIds: ids, title: "Aapke liye picks" });
    return { reply: "Ek second, screen pe dikha raha hoon... ye dekhiye! Konsa pasand aaya? 😊", toolCalls: calls, lastShownIds: ids };
  }

  // greeting / default
  if (has(t, "hello", "hi", "namaste", "hey", "raj")) {
    return { reply: "Namaste ji! Main Raj, aapka waiter. Bataiye kya khaane ka mann hai — veg ya non-veg? 😄", toolCalls: calls };
  }

  return {
    reply: "Ji bataiye — kuch spicy, kuch meetha, ya koi combo dikhau? Aap bol ke order kar sakte hain. 😊",
    toolCalls: calls,
  };
}

function qtyFrom(t: string): number {
  const map: Record<string, number> = { ek: 1, do: 2, teen: 3, char: 4, paanch: 5 };
  for (const [w, n] of Object.entries(map)) if (t.includes(w + " ")) return n;
  const m = t.match(/(\d+)/);
  return m ? Math.max(1, parseInt(m[1], 10)) : 1;
}

function cleanName(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(add|karo|kar do|kardo|lelo|le lo|chahiye|mangwa do|mangwao|order|ek|do|teen|please|ji|dikhao|dega|de do|wala|wali|mujhe|na|to)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
