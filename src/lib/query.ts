import type { NextApiRequest } from 'next';
import { paginationConfig } from '@/config';

export type PageMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  from: number;
  to: number;
};

export type Paginated<T> = { items: T[]; meta: PageMeta };

export function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function queryString(req: NextApiRequest, key: string): string | undefined {
  const value = firstValue(req.query[key]);
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || undefined;
}

export function queryEnum<T extends string>(
  req: NextApiRequest,
  key: string,
  allowed: readonly T[]
): T | undefined {
  const value = queryString(req, key);
  return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export function queryBoolean(req: NextApiRequest, key: string): boolean | undefined {
  const value = queryString(req, key)?.toLowerCase();
  if (value === undefined) return undefined;
  if (['1', 'true', 'yes'].includes(value)) return true;
  if (['0', 'false', 'no'].includes(value)) return false;
  return undefined;
}

export function queryInt(req: NextApiRequest, key: string, fallback: number, min: number, max: number): number {
  const raw = queryString(req, key);
  if (raw === undefined) return fallback;
  const value = Math.trunc(Number(raw));
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function queryPagination(req: NextApiRequest) {
  const page = queryInt(req, 'page', 1, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = queryInt(req, 'pageSize', paginationConfig.pageSize, 1, paginationConfig.maxPageSize);
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPageMeta(page: number, pageSize: number, total: number): PageMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: totalPages > 0 && page < totalPages,
    from,
    to
  };
}

export function paginate<T>(items: T[], page: number, pageSize: number, total: number): Paginated<T> {
  return { items, meta: buildPageMeta(page, pageSize, total) };
}

export function buildSearchFilter(term: string | undefined, fields: string[]) {
  if (!term) return undefined;
  return { OR: fields.map((field) => ({ [field]: { contains: term } })) };
}
