import { BotClient } from "@/components/bot/BotClient";

export const dynamic = "force-dynamic";

export default async function BotTablePage({ params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const tableNumber = parseInt(tableId, 10) || 1;
  return <BotClient tableNumber={tableNumber} />;
}
