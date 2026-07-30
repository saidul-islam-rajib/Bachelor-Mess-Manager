import { round2 } from '@/lib/month';

export type ItemInput = { name: string; amount: number };

export type ParsedItems = { items: ItemInput[]; total: number } | { error: string };

const MAX_ITEMS = 30;
const MAX_NAME = 120;

export function parseItems(raw: unknown): ParsedItems {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: 'Add at least one product.' };
  }
  if (raw.length > MAX_ITEMS) {
    return { error: `A purchase can hold at most ${MAX_ITEMS} products.` };
  }

  const items: ItemInput[] = [];

  for (const entry of raw) {
    const record = entry as { name?: unknown; amount?: unknown };
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const amount = Number(record.amount);

    if (!name) {
      return { error: 'Every product needs a name.' };
    }
    if (name.length > MAX_NAME) {
      return { error: `Product names must be under ${MAX_NAME} characters.` };
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return { error: `Enter a positive price for "${name}".` };
    }

    items.push({ name, amount: round2(amount) });
  }

  return { items, total: round2(items.reduce((sum, item) => sum + item.amount, 0)) };
}
