import { z } from 'zod';

const dailyRate = z.object({ date: z.string(), rate: z.number(), isToday: z.boolean() });

const memberMonth = z.object({
  meals: z.number(),
  mealCost: z.number(),
  billShare: z.number(),
  totalCost: z.number(),
  bazarPaid: z.number(),
  collected: z.number(),
  due: z.number(),
  status: z.string(),
  mealRate: z.number(),
  rateMode: z.string(),
  dailyRate: dailyRate.nullable(),
  todayMeals: z.object({ breakfast: z.number(), lunch: z.number(), dinner: z.number(), total: z.number() }),
});

const memberDashboard = z.object({
  group: z.object({ id: z.string(), name: z.string() }).nullable(),
  pendingInvitations: z.number(),
  current: memberMonth.nullable(),
});

export const dashboardSchema = z.object({
  role: z.enum(['ADMIN', 'SUPERVISOR', 'MEMBER']),
  month: z.string(),
  member: memberDashboard.optional(),
});

export type Dashboard = z.infer<typeof dashboardSchema>;
