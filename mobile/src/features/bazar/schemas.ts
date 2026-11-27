import { z } from 'zod';

export const dutyDay = z.object({
  day: z.number(),
  date: z.string(),
  userId: z.string().nullable(),
  userName: z.string().nullable(),
});

export const bazarScheduleSchema = z.object({
  monthKey: z.string(),
  totalDays: z.number(),
  editable: z.boolean(),
  lockedReason: z.enum(['GROUP_CLOSED', 'MONTH_CLOSED', 'NO_MEMBERS']).nullable(),
  canManage: z.boolean(),
  isAdmin: z.boolean(),
  currentUserId: z.string(),
  members: z.array(z.object({ id: z.string(), name: z.string(), dayCount: z.number() })),
  days: z.array(dutyDay),
});

export const expenseItem = z.object({ id: z.string(), name: z.string(), amount: z.number() });

export const expenseComment = z.object({
  id: z.string(),
  text: z.string(),
  authorId: z.string(),
  authorName: z.string(),
  createdAt: z.string(),
});

export const expense = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number(),
  note: z.string(),
  payer: z.object({ id: z.string(), name: z.string(), email: z.string() }).nullable(),
  items: z.array(expenseItem),
  comments: z.array(expenseComment),
});

export const expensesMonthSchema = z.object({
  expenses: z.array(expense),
  members: z.array(z.object({ id: z.string(), name: z.string() })),
  mentionNames: z.record(z.string(), z.string()),
  isSupervisor: z.boolean(),
  currentUserId: z.string(),
});

export const expenseSaveResponseSchema = z.object({
  expense: z.object({ id: z.string(), date: z.string(), amount: z.number(), note: z.string(), items: z.array(expenseItem) }),
});

export const expenseDeletedSchema = z.object({ deleted: z.boolean() });

export const expenseCommentResponseSchema = z.object({ comment: expenseComment });

export type BazarSchedule = z.infer<typeof bazarScheduleSchema>;
export type Expense = z.infer<typeof expense>;
export type ExpensesMonth = z.infer<typeof expensesMonthSchema>;
export type ItemInput = { name: string; amount: number };
