// Seed the database only if it's empty (safe to run on every deploy/start).
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  let count = 0;
  try {
    count = await prisma.menuItem.count();
  } catch {
    count = 0;
  }
  await prisma.$disconnect();
  if (count === 0) {
    console.log("DB empty → seeding…");
    execSync("tsx prisma/seed.ts", { stdio: "inherit" });
  } else {
    console.log(`DB already has ${count} menu items → skipping seed.`);
  }
}

main();
