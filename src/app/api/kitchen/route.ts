import { NextResponse } from "next/server";
import { getKitchenBoard } from "@/lib/kitchen";

export const dynamic = "force-dynamic";

export async function GET() {
  const board = await getKitchenBoard();
  return NextResponse.json(board);
}
