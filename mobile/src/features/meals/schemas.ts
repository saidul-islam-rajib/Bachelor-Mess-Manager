import { z } from 'zod';

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const mealCounts = z.object({ breakfast: z.number(), lunch: z.number(), dinner: z.number() });

const mealEntry = mealCounts.extend({ userId: z.string(), date: dayKey });

export const editWindowSchema = z.object({
  open: z.boolean(),
  unlimited: z.boolean(),
  openedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  secondsRemaining: z.number().nullable(),
  windowMinutes: z.number(),
  requiresApproval: z.boolean(),
  approvalSetBySupervisor: z.boolean(),
});

export const mealChangeRequest = z.object({
  id: z.string(),
  userId: z.string(),
  userName: z.string().nullable(),
  groupId: z.string(),
  date: dayKey,
  from: mealCounts,
  to: mealCounts,
  summary: z.string(),
  reason: z.string().nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
  pending: z.boolean(),
  decidedAt: z.string().nullable(),
  decidedByName: z.string().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: z.string(),
});

export const mealsMonthSchema = z.object({
  canManage: z.boolean(),
  currentUserId: z.string(),
  groupStatus: z.string(),
  members: z.array(z.object({ id: z.string(), name: z.string(), email: z.string() })),
  weights: mealCounts,
  entries: z.array(mealEntry),
  editWindow: editWindowSchema,
  pendingChanges: z.array(mealChangeRequest),
});

export const mealSaveResponseSchema = z.object({
  applied: z.boolean(),
  unchanged: z.boolean().optional(),
  pending: z.boolean().optional(),
  entry: mealEntry.optional(),
  request: mealChangeRequest.optional(),
});

export const editWindowResponseSchema = z.object({ window: editWindowSchema });

export const mealChangeCancelledSchema = z.object({ status: z.literal('CANCELLED') });

export type MealCounts = z.infer<typeof mealCounts>;
export type MealsMonth = z.infer<typeof mealsMonthSchema>;
export type MealChangeRequest = z.infer<typeof mealChangeRequest>;
export type EditWindow = z.infer<typeof editWindowSchema>;
