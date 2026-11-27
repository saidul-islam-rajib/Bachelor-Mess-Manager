import { z } from 'zod';

export const closingLineSchema = z.object({
  userId: z.string(),
  userName: z.string(),
  carryIn: z.number(),
  mealCount: z.number(),
  mealCost: z.number(),
  billShare: z.number(),
  bazarPaid: z.number(),
  cashPaid: z.number(),
  carryOut: z.number(),
});

export const closingSchema = z.object({
  id: z.string(),
  monthKey: z.string(),
  closedThrough: z.string(),
  closedAt: z.string(),
  closedBy: z.string().nullable(),
  note: z.string().nullable(),
  reopenedAt: z.string().nullable(),
  settledAt: z.string().nullable(),
  settledBy: z.string().nullable(),
  scope: z.enum(['GROUP', 'MEMBERS']),
  lines: z.array(closingLineSchema),
});

export const closingListSchema = z.object({ canManage: z.boolean(), closings: z.array(closingSchema) });
export const closeMonthSchema = z.object({ closingId: z.string(), members: z.number(), carriedForward: z.number() });
export const closingReopenedSchema = z.object({ reopened: z.boolean() });

export const finalMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  meals: z.number(),
  totalCost: z.number(),
  cashPaid: z.number(),
  dueAtClose: z.number(),
  liveDue: z.number(),
  status: z.string(),
  isCurrentMember: z.boolean(),
});

export const finalSettlementSchema = z.object({
  groupId: z.string(),
  groupName: z.string(),
  closingId: z.string(),
  monthKey: z.string(),
  closedThrough: z.string(),
  settledAt: z.string().nullable(),
  mealRate: z.number(),
  members: z.array(finalMemberSchema),
  settleUp: z.object({
    transfers: z.array(z.object({ direction: z.enum(['out', 'in']), counterpartyName: z.string(), amount: z.number() })),
    unmatched: z.number(),
    surplus: z.number(),
  }),
  allClear: z.boolean(),
});

export const finalSettlementResponseSchema = z.object({ canManage: z.boolean(), settlement: finalSettlementSchema.nullable() });

export type Closing = z.infer<typeof closingSchema>;
export type FinalSettlement = z.infer<typeof finalSettlementSchema>;
