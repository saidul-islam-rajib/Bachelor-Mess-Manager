import { z } from 'zod';

const dateKey = z.string();

export const collectionSchema = z.object({
  id: z.string(),
  amount: z.number(),
  date: dateKey,
  recordedAt: z.string(),
  recordedByName: z.string().nullable(),
  isReversal: z.boolean(),
  isReversed: z.boolean(),
  isLinked: z.boolean(),
  toUserName: z.string().nullable(),
  fromUserName: z.string().nullable(),
  fromAdvance: z.boolean(),
  fromPayer: z.boolean(),
});

export const shareSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  amount: z.number(),
  paid: z.number(),
  outstanding: z.number(),
  advance: z.number(),
  status: z.string(),
  isShare: z.boolean(),
  collections: z.array(collectionSchema),
});

export const billSchema = z.object({
  id: z.string(),
  type: z.string(),
  amount: z.number(),
  date: dateKey,
  note: z.string(),
  isReceived: z.boolean(),
  splitMethod: z.enum(['EQUAL', 'CUSTOM']),
  payer: z.object({ id: z.string(), name: z.string() }).nullable(),
  shares: z.array(shareSchema),
  collected: z.number(),
  uncollected: z.number(),
  advance: z.number(),
  isFullyCollected: z.boolean(),
  unpaidMemberCount: z.number(),
});

export const billsMonthSchema = z.object({
  canManage: z.boolean(),
  canRecordOwn: z.boolean(),
  currentUserId: z.string(),
  categories: z.array(z.string()),
  categoryLabels: z.record(z.string(), z.string()),
  bills: z.array(billSchema),
  members: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
  totals: z.object({
    total: z.number(),
    settled: z.number(),
    outstanding: z.number(),
    collected: z.number(),
    uncollected: z.number(),
  }),
});

const billSummary = z.object({ id: z.string(), type: z.string(), amount: z.number(), date: dateKey, note: z.string() });

export const billSavedSchema = z.object({ bill: billSummary });
export const billDeletedSchema = z.object({ deleted: z.boolean() });

export const collectionCreatedSchema = z.object({
  collection: z.object({ id: z.string(), userId: z.string(), userName: z.string(), amount: z.number(), date: dateKey }),
  totals: z.object({ collected: z.number(), outstanding: z.number(), unpaidMemberCount: z.number(), isFullyCollected: z.boolean() }),
});

export const collectionRemovedSchema = z.object({
  deleted: z.boolean().optional(),
  reversed: z.boolean().optional(),
  amount: z.number().optional(),
});

export type Bill = z.infer<typeof billSchema>;
export type BillShare = z.infer<typeof shareSchema>;
export type BillsMonth = z.infer<typeof billsMonthSchema>;
