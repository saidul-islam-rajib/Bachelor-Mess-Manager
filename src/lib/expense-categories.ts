import { prisma } from '@/lib/prisma';
import { BILL_TYPE_VALUES, EXPENSE_TYPE_LABELS, EXPENSE_TYPES } from '@/lib/constants';

export type Category = {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
  sortOrder: number;
  archived: boolean;
  inUse?: number;
};

export const MAX_CATEGORY_LABEL = 40;
export const MAX_CATEGORIES_PER_GROUP = 40;

export function toCategoryCode(label: string): string {
  return label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function serialize(row: {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
  sortOrder: number;
  archivedAt: Date | null;
}): Category {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    isSystem: row.isSystem,
    sortOrder: row.sortOrder,
    archived: row.archivedAt !== null
  };
}

export async function ensureCategories(groupId: string): Promise<Category[]> {
  const existing = await prisma.expenseCategory.findMany({
    where: { groupId },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }]
  });

  if (existing.length > 0) return existing.map(serialize);

  const now = new Date();
  await prisma.expenseCategory.createMany({
    data: BILL_TYPE_VALUES.map((code, index) => ({
      groupId,
      code,
      label: EXPENSE_TYPE_LABELS[code] ?? code,
      isSystem: true,
      sortOrder: index,
      publishedAt: now
    }))
  });

  const seeded = await prisma.expenseCategory.findMany({
    where: { groupId },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }]
  });
  return seeded.map(serialize);
}

export async function listCategories(groupId: string, options: { includeArchived?: boolean } = {}) {
  const all = await ensureCategories(groupId);
  return options.includeArchived ? all : all.filter((category) => !category.archived);
}

export async function categoryLabels(groupId: string): Promise<Record<string, string>> {
  const all = await ensureCategories(groupId);
  const labels: Record<string, string> = { [EXPENSE_TYPES.BAZAR]: EXPENSE_TYPE_LABELS[EXPENSE_TYPES.BAZAR] };
  for (const category of all) labels[category.code] = category.label;
  return labels;
}

export async function isValidBillType(groupId: string, code: unknown): Promise<boolean> {
  if (typeof code !== 'string' || !code) return false;
  if (code === EXPENSE_TYPES.BAZAR) return false;

  const categories = await listCategories(groupId);
  return categories.some((category) => category.code === code);
}

export async function countUsage(groupId: string, codes: string[]): Promise<Record<string, number>> {
  if (codes.length === 0) return {};

  const rows = await prisma.expenseEntry.groupBy({
    by: ['type'],
    where: { groupId, type: { in: codes } },
    _count: { _all: true }
  });

  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.type] = row._count._all;
  return counts;
}
