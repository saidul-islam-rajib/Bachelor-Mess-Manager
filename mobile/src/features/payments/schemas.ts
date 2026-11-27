import { z } from 'zod';

export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  meals: z.number(),
  carryIn: z.number(),
  cost: z.number(),
  collected: z.number(),
  due: z.number(),
  status: z.string(),
  isActive: z.boolean(),
});

export const paymentRowSchema = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string(),
  amount: z.number(),
  date: z.string(),
  billId: z.string().nullable(),
  billType: z.string().nullable(),
  isReversal: z.boolean(),
  isReversed: z.boolean(),
  isLinked: z.boolean(),
});

export const paymentsMonthSchema = z.object({
  canManage: z.boolean(),
  currentUserId: z.string(),
  closing: z.object({ closedAt: z.string(), closedThrough: z.string(), closedBy: z.string().nullable() }).nullable(),
  categoryLabels: z.record(z.string(), z.string()),
  members: z.array(memberSchema),
  payments: z.array(paymentRowSchema),
  totals: z.object({ cost: z.number(), collected: z.number(), outstanding: z.number(), refunds: z.number() }),
});

export const advancesSchema = z.object({
  canManage: z.boolean(),
  currentUserId: z.string(),
  members: z.array(z.object({ id: z.string(), name: z.string(), balance: z.number() })),
  history: z.array(
    z.object({
      id: z.string(),
      userId: z.string(),
      userName: z.string(),
      amount: z.number(),
      note: z.string().nullable(),
      expenseId: z.string().nullable(),
      reversalOfId: z.string().nullable(),
      isReversed: z.boolean(),
      createdAt: z.string(),
    }),
  ),
});

export const paymentCreatedSchema = z.object({ payment: z.object({ id: z.string(), userId: z.string(), amount: z.number(), date: z.string() }) });
export const paymentUpdatedSchema = z.object({ updated: z.boolean() });
export const paymentRemovedSchema = z.object({ reversed: z.boolean().optional(), deleted: z.boolean().optional(), amount: z.number().optional() });
export const advanceCreatedSchema = z.object({ advance: z.object({ id: z.string(), userId: z.string(), amount: z.number() }) });
export const advanceReversedSchema = z.object({ reversed: z.boolean(), amount: z.number() });

export type PaymentsMonth = z.infer<typeof paymentsMonthSchema>;
export type PaymentRow = z.infer<typeof paymentRowSchema>;
export type Advances = z.infer<typeof advancesSchema>;
