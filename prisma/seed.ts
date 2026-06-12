import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function photo(keywords: string) {
  return `https://loremflickr.com/600/400/${encodeURIComponent(keywords)}`;
}

type SeedItem = {
  nameEn: string;
  nameHi: string;
  category: string;
  cuisineType: string;
  price: number;
  isVeg: boolean;
  description: string;
  prepTimeMinutes: number;
  emoji: string;
  spiceLevel: number;
  tags: string;
  bestseller?: boolean;
  recommended?: boolean;
  photoKw: string;
};

const ITEMS: SeedItem[] = [
  { nameEn: "Butter Chicken", nameHi: "बटर चिकन", category: "Main Course", cuisineType: "North Indian", price: 320, isVeg: false, description: "Creamy tomato gravy with tender chicken.", prepTimeMinutes: 18, emoji: "🍛", spiceLevel: 2, tags: "creamy,popular,gravy", bestseller: true, recommended: true, photoKw: "butter,chicken,curry" },
  { nameEn: "Chicken Tikka", nameHi: "चिकन टिक्का", category: "Starter", cuisineType: "North Indian", price: 280, isVeg: false, description: "Char-grilled spiced chicken chunks.", prepTimeMinutes: 16, emoji: "🍢", spiceLevel: 2, tags: "grilled,tandoor,starter", bestseller: true, photoKw: "chicken,tikka,tandoori" },
  { nameEn: "Paneer Tikka", nameHi: "पनीर टिक्का", category: "Starter", cuisineType: "North Indian", price: 250, isVeg: true, description: "Smoky grilled cottage cheese with peppers.", prepTimeMinutes: 15, emoji: "🧆", spiceLevel: 2, tags: "grilled,veg,starter", recommended: true, photoKw: "paneer,tikka" },
  { nameEn: "Dal Makhani", nameHi: "दाल मखनी", category: "Main Course", cuisineType: "North Indian", price: 220, isVeg: true, description: "Slow-cooked black lentils in butter & cream.", prepTimeMinutes: 20, emoji: "🍲", spiceLevel: 1, tags: "creamy,veg,dal", bestseller: true, photoKw: "dal,makhani,lentil" },
  { nameEn: "Shahi Paneer", nameHi: "शाही पनीर", category: "Main Course", cuisineType: "North Indian", price: 260, isVeg: true, description: "Cottage cheese in rich cashew gravy.", prepTimeMinutes: 18, emoji: "🍛", spiceLevel: 1, tags: "creamy,veg,gravy", photoKw: "shahi,paneer,curry" },
  { nameEn: "Veg Biryani", nameHi: "वेज बिरयानी", category: "Rice", cuisineType: "Hyderabadi", price: 230, isVeg: true, description: "Fragrant basmati rice with garden vegetables.", prepTimeMinutes: 22, emoji: "🍚", spiceLevel: 2, tags: "rice,veg,biryani", photoKw: "veg,biryani,rice" },
  { nameEn: "Chicken Biryani", nameHi: "चिकन बिरयानी", category: "Rice", cuisineType: "Hyderabadi", price: 300, isVeg: false, description: "Dum-cooked biryani with spiced chicken.", prepTimeMinutes: 25, emoji: "🍛", spiceLevel: 3, tags: "rice,biryani,spicy", bestseller: true, recommended: true, photoKw: "chicken,biryani" },
  { nameEn: "Butter Naan", nameHi: "बटर नान", category: "Bread", cuisineType: "North Indian", price: 50, isVeg: true, description: "Soft tandoori bread brushed with butter.", prepTimeMinutes: 8, emoji: "🫓", spiceLevel: 0, tags: "bread,tandoor", bestseller: true, photoKw: "naan,bread" },
  { nameEn: "Garlic Naan", nameHi: "गार्लिक नान", category: "Bread", cuisineType: "North Indian", price: 60, isVeg: true, description: "Naan topped with garlic & coriander.", prepTimeMinutes: 8, emoji: "🧄", spiceLevel: 0, tags: "bread,garlic,tandoor", photoKw: "garlic,naan" },
  { nameEn: "Jeera Rice", nameHi: "जीरा राइस", category: "Rice", cuisineType: "North Indian", price: 140, isVeg: true, description: "Basmati rice tempered with cumin.", prepTimeMinutes: 12, emoji: "🍚", spiceLevel: 0, tags: "rice,veg", photoKw: "jeera,rice,cumin" },
  { nameEn: "Masala Dosa", nameHi: "मसाला डोसा", category: "South Indian", cuisineType: "South Indian", price: 160, isVeg: true, description: "Crispy dosa with spiced potato filling.", prepTimeMinutes: 14, emoji: "🥞", spiceLevel: 1, tags: "dosa,south,veg", recommended: true, photoKw: "masala,dosa" },
  { nameEn: "Fried Rice", nameHi: "फ्राइड राइस", category: "Chinese", cuisineType: "Indo-Chinese", price: 180, isVeg: true, description: "Wok-tossed rice with veggies & soy.", prepTimeMinutes: 14, emoji: "🍚", spiceLevel: 1, tags: "rice,chinese", photoKw: "fried,rice,chinese" },
  { nameEn: "Hakka Noodles", nameHi: "हक्का नूडल्स", category: "Chinese", cuisineType: "Indo-Chinese", price: 190, isVeg: true, description: "Stir-fried noodles with crunchy vegetables.", prepTimeMinutes: 14, emoji: "🍜", spiceLevel: 2, tags: "noodles,chinese", bestseller: true, photoKw: "hakka,noodles" },
  { nameEn: "Manchurian", nameHi: "मंचूरियन", category: "Chinese", cuisineType: "Indo-Chinese", price: 200, isVeg: true, description: "Veg balls in tangy spicy sauce.", prepTimeMinutes: 16, emoji: "🍢", spiceLevel: 3, tags: "chinese,spicy,starter", photoKw: "manchurian,gravy" },
  { nameEn: "Sweet Lassi", nameHi: "मीठी लस्सी", category: "Beverage", cuisineType: "North Indian", price: 80, isVeg: true, description: "Chilled sweet yogurt drink.", prepTimeMinutes: 5, emoji: "🥛", spiceLevel: 0, tags: "drink,sweet,cold", photoKw: "lassi,yogurt,drink" },
  { nameEn: "Mango Shake", nameHi: "मैंगो शेक", category: "Beverage", cuisineType: "Continental", price: 120, isVeg: true, description: "Thick mango milkshake.", prepTimeMinutes: 5, emoji: "🥤", spiceLevel: 0, tags: "drink,mango,cold", recommended: true, photoKw: "mango,milkshake" },
  { nameEn: "Masala Chai", nameHi: "मसाला चाय", category: "Beverage", cuisineType: "North Indian", price: 40, isVeg: true, description: "Spiced Indian tea with milk.", prepTimeMinutes: 6, emoji: "☕", spiceLevel: 0, tags: "drink,tea,hot", photoKw: "masala,chai,tea" },
  { nameEn: "Gulab Jamun", nameHi: "गुलाब जामुन", category: "Dessert", cuisineType: "North Indian", price: 90, isVeg: true, description: "Warm milk dumplings in sugar syrup.", prepTimeMinutes: 6, emoji: "🍮", spiceLevel: 0, tags: "dessert,sweet", bestseller: true, photoKw: "gulab,jamun,dessert" },
  { nameEn: "Brownie", nameHi: "ब्राउनी", category: "Dessert", cuisineType: "Continental", price: 130, isVeg: true, description: "Fudgy chocolate brownie.", prepTimeMinutes: 7, emoji: "🍫", spiceLevel: 0, tags: "dessert,chocolate", photoKw: "chocolate,brownie" },
  { nameEn: "Ice Cream", nameHi: "आइसक्रीम", category: "Dessert", cuisineType: "Continental", price: 100, isVeg: true, description: "Two scoops of vanilla & chocolate.", prepTimeMinutes: 3, emoji: "🍨", spiceLevel: 0, tags: "dessert,cold", recommended: true, photoKw: "ice,cream,dessert" },
];

type SeedCombo = {
  nameEn: string;
  nameHi: string;
  description: string;
  category: string;
  emoji: string;
  comboPrice: number;
  items: { name: string; quantity: number }[];
  photoKw: string;
};

const COMBOS: SeedCombo[] = [
  { nameEn: "Butter Chicken Combo", nameHi: "बटर चिकन कॉम्बो", description: "Butter Chicken + 2 Butter Naan + Jeera Rice", category: "Non-Veg Combo", emoji: "🍱", comboPrice: 460, items: [{ name: "Butter Chicken", quantity: 1 }, { name: "Butter Naan", quantity: 2 }, { name: "Jeera Rice", quantity: 1 }], photoKw: "butter,chicken,thali" },
  { nameEn: "Paneer Thali Combo", nameHi: "पनीर थाली कॉम्बो", description: "Shahi Paneer + Dal Makhani + 2 Garlic Naan", category: "Veg Combo", emoji: "🍱", comboPrice: 520, items: [{ name: "Shahi Paneer", quantity: 1 }, { name: "Dal Makhani", quantity: 1 }, { name: "Garlic Naan", quantity: 2 }], photoKw: "paneer,thali,indian" },
  { nameEn: "Biryani Combo", nameHi: "बिरयानी कॉम्बो", description: "Chicken Biryani + Sweet Lassi + Gulab Jamun", category: "Non-Veg Combo", emoji: "🍱", comboPrice: 420, items: [{ name: "Chicken Biryani", quantity: 1 }, { name: "Sweet Lassi", quantity: 1 }, { name: "Gulab Jamun", quantity: 1 }], photoKw: "biryani,combo" },
  { nameEn: "Chinese Combo", nameHi: "चाइनीज़ कॉम्बो", description: "Hakka Noodles + Manchurian + Fried Rice", category: "Chinese Combo", emoji: "🍱", comboPrice: 480, items: [{ name: "Hakka Noodles", quantity: 1 }, { name: "Manchurian", quantity: 1 }, { name: "Fried Rice", quantity: 1 }], photoKw: "chinese,combo,noodles" },
  { nameEn: "Dessert Combo", nameHi: "डेज़र्ट कॉम्बो", description: "Gulab Jamun + Brownie + Ice Cream", category: "Dessert Combo", emoji: "🍨", comboPrice: 260, items: [{ name: "Gulab Jamun", quantity: 1 }, { name: "Brownie", quantity: 1 }, { name: "Ice Cream", quantity: 1 }], photoKw: "dessert,platter" },
];

async function main() {
  console.log("🌱 Seeding Dinex Bot...");

  // Reset data (idempotent seed)
  await prisma.comboItem.deleteMany();
  await prisma.combo.deleteMany();
  await prisma.menuItem.deleteMany();

  // Restaurant settings
  await prisma.restaurantSettings.upsert({
    where: { id: 1 },
    update: { restaurantName: "Chowzy", logoText: "Chowzy", aiWaiterName: "Dinex Bot" },
    create: { id: 1, restaurantName: "Chowzy", logoText: "Chowzy", aiWaiterName: "Dinex Bot" },
  });

  // Menu items
  const idByName = new Map<string, string>();
  for (const it of ITEMS) {
    const created = await prisma.menuItem.create({
      data: {
        nameEn: it.nameEn,
        nameHi: it.nameHi,
        category: it.category,
        cuisineType: it.cuisineType,
        price: it.price,
        isVeg: it.isVeg,
        description: it.description,
        prepTimeMinutes: it.prepTimeMinutes,
        photoUrl: photo(it.photoKw),
        emoji: it.emoji,
        available: true,
        spiceLevel: it.spiceLevel,
        tags: it.tags,
        bestseller: !!it.bestseller,
        recommended: !!it.recommended,
        totalOrders: Math.floor(Math.random() * 80) + (it.bestseller ? 120 : 10),
      },
    });
    idByName.set(it.nameEn, created.id);
  }

  // Combos
  for (const c of COMBOS) {
    const original = c.items.reduce((sum, ci) => {
      const item = ITEMS.find((i) => i.nameEn === ci.name)!;
      return sum + item.price * ci.quantity;
    }, 0);
    await prisma.combo.create({
      data: {
        nameEn: c.nameEn,
        nameHi: c.nameHi,
        description: c.description,
        category: c.category,
        emoji: c.emoji,
        photoUrl: photo(c.photoKw),
        originalPrice: original,
        comboPrice: c.comboPrice,
        savings: original - c.comboPrice,
        active: true,
        items: {
          create: c.items.map((ci) => ({
            menuItemId: idByName.get(ci.name)!,
            quantity: ci.quantity,
          })),
        },
      },
    });
  }

  console.log(`✅ Seeded ${ITEMS.length} menu items and ${COMBOS.length} combos for Swad Mahal.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
