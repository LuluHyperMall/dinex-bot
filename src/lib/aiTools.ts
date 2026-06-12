// OpenAI tool (function-calling) definitions for Raj + the system prompt.

import type { Settings } from "./settings";

export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "getMenuItems",
      description: "List menu items, optionally filtered. Use to know what's actually available before recommending.",
      parameters: {
        type: "object",
        properties: {
          category: { type: "string", description: "e.g. Starter, Main Course, Rice, Bread, Dessert, Beverage, Chinese, South Indian" },
          cuisine: { type: "string" },
          vegOnly: { type: "boolean" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searchMenuItems",
      description: "Fuzzy-search the menu by a phrase (handles imperfect/Hinglish names like 'spicy chicken', 'paneer', 'meetha').",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, vegOnly: { type: "boolean" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getAvailableCombos",
      description: "Get all active combo deals with their savings.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getBestSellers",
      description: "Get the most-ordered items (real counts) to recommend confidently.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "getSlowMovingItems",
      description: "Get least-ordered items.",
      parameters: { type: "object", properties: { limit: { type: "number" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "showDishCards",
      description: "Display dish photo cards on the customer's screen. ALWAYS call this when recommending or talking about specific dishes. Pass the itemIds you got from a menu/search tool, in the order you want them shown.",
      parameters: {
        type: "object",
        properties: {
          itemIds: { type: "array", items: { type: "string" }, description: "Menu item ids to show (preferred)." },
          query: { type: "string", description: "Alternatively, a search query to resolve cards from." },
          title: { type: "string", description: "Short heading shown above the cards, e.g. 'Spicy Chicken Picks'." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "showComboCards",
      description: "Display combo photo cards on the screen. Call this whenever suggesting combos.",
      parameters: {
        type: "object",
        properties: {
          comboIds: { type: "array", items: { type: "string" } },
          title: { type: "string" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "addItemToOrder",
      description: "Add a dish to the running order. Confirm with the customer and mention the price BEFORE calling. Use itemId when you have it (e.g. from cards you just showed — 'pehla wala' = first card's id).",
      parameters: {
        type: "object",
        properties: {
          itemId: { type: "string" },
          name: { type: "string", description: "Fallback if no id." },
          quantity: { type: "number" },
          specialInstructions: { type: "string", description: "e.g. 'extra spicy', 'no onion'." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "addComboToOrder",
      description: "Add a combo to the running order.",
      parameters: {
        type: "object",
        properties: { comboId: { type: "string" }, name: { type: "string" }, quantity: { type: "number" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "removeItemFromOrder",
      description: "Remove an item from the order.",
      parameters: { type: "object", properties: { itemId: { type: "string" }, name: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "updateItemQuantity",
      description: "Change the quantity of an item already in the order.",
      parameters: {
        type: "object",
        properties: { itemId: { type: "string" }, name: { type: "string" }, quantity: { type: "number" } },
        required: ["quantity"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "getCurrentOrder",
      description: "Read back the current order items.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getCurrentBill",
      description: "Get the live bill (subtotal, GST, service charge, total).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "confirmOrder",
      description: "Customer has confirmed the order — send it to the kitchen. Only call after the customer agrees.",
      parameters: { type: "object", properties: { specialInstructions: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "sendOrderToKitchen",
      description: "Dispatch the confirmed order to the kitchen (same as confirmOrder).",
      parameters: { type: "object", properties: { specialInstructions: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "requestBill",
      description: "Customer wants the bill — switch the screen to billing.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "showPaymentQR",
      description: "Show the UPI payment QR code for the current total.",
      parameters: { type: "object", properties: { method: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "callStaff",
      description: "Customer asked for a human/staff member.",
      parameters: { type: "object", properties: { reason: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "endSession",
      description: "End the dining session after payment is done AND the guest confirms they're finished. Frees the table. Only call after the guest says yes to ending.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getKitchenStatus",
      description: "Check the kitchen status / ETA of the customer's confirmed orders.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "getSessionPreferences",
      description: "Read the saved preferences for this table session.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "updateSessionPreferences",
      description: "Save customer preferences as you learn them.",
      parameters: {
        type: "object",
        properties: {
          veg: { type: "string", description: "veg | nonveg | both" },
          spice: { type: "string", description: "mild | medium | spicy" },
          cuisine: { type: "string" },
          partySize: { type: "number" },
          allergies: { type: "string" },
        },
      },
    },
  },
];

// Realtime API expects flat { type, name, description, parameters } (no nested "function").
export const REALTIME_TOOL_DEFS = TOOL_DEFS.map((t) => ({
  type: "function" as const,
  name: t.function.name,
  description: t.function.description,
  parameters: t.function.parameters,
}));

export function buildSystemPrompt(settings: Settings, tableNumber: number): string {
  const name = settings.aiWaiterName || "Dinex Bot";
  return `You are ${name}, the AI waiter at "${settings.restaurantName}". Serving Table ${tableNumber}. Speak warm, natural Hinglish (mostly romanized Hindi).

#1 RULE — BE BRIEF & DON'T OVER-TALK:
- Reply in ONE short sentence (rarely two). Never ramble, never give long descriptions, never repeat yourself.
- ONLY respond to what the guest just said. Do NOT chatter, do NOT fill silence, do NOT add extra commentary. If there's nothing to say, say nothing.
- No long sales pitches. No jokes unless natural.

FOLLOW THIS EXACT FLOW:
1. GREETING (only once at the very start): "Namaste, kaise hain aap? Chowzy mein aapka swagat hai — aap veg khayenge ya non-veg?"
2. Guest says veg / non-veg (or a craving like "spicy", "paneer", "biryani") → IMMEDIATELY call showDishCards with matching items (use getMenuItems / searchMenuItems / getBestSellers to get itemIds). Say ONE short line: "Ye dekhiye menu, kya pasand aaya?"
3. Guest names a dish → call addItemToOrder RIGHT AWAY (one call per item). Say ONE short line with price: "Butter Chicken add kiya, ₹320." The bill updates automatically in realtime.
4. When ordering, suggest only ONE or TWO best-fit items that go WITH their choice — once, briefly. E.g. curry → "Saath mein garlic naan?"; biryani → "Ek thandi lassi?". If they say no, drop it instantly. Never push more than 1-2.
5. Guest says they're done / "confirm" / "order kar do" → call confirmOrder (sends to kitchen). Say: "Order kitchen bhej diya!"
6. Bill: "bill lao" / "kitna hua" → requestBill. "QR" / "payment" → showPaymentQR.
7. After payment is successful (system tells you) → ask ONCE: "Khana ho gaya? Session end kar dun?" Only if guest says yes → call endSession, then "Dhanyavaad, phir aaiyega!".

KITCHEN UPDATES: When the system gives a kitchen update, announce it in ONE short line ("Khana ban raha hai!", "Bas 10 minute!", "Khana ready hai!").

HARD RULES:
- You ONLY know the menu via tools — NEVER invent dishes/prices/counts.
- Whenever you mention specific dishes, call showDishCards (showComboCards for combos) so photos appear.
- "pehla wala" = first card shown, "dusra wala" = second → map to the right itemId.
- "staff bulao" → callStaff.
- Keep EVERY reply short. Currency ${settings.currencySymbol}. Less talking, more doing.`;
}
