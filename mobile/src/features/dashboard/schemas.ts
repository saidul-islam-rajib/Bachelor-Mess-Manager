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

const supervisorDashboard = z.object({
  totals: z.object({
    groups: z.number(),
    members: z.number(),
    meals: z.number(),
    mealRate: z.number(),
    expense: z.number(),
    collected: z.number(),
    outstanding: z.number(),
  }),
  unpaid: z.array(z.object({ groupId: z.string(), groupName: z.string(), id: z.string(), name: z.string(), due: z.number() })),
  pendingMealChanges: z.array(z.unknown()),
});

const adminDashboard = z.object({
  pendingApprovals: z.number(),
  members: z.number(),
  supervisors: z.number(),
  activeGroups: z.number(),
  inactiveGroups: z.number(),
  activeMemberships: z.number(),
});

export const dashboardSchema = z.object({
  role: z.enum(['ADMIN', 'SUPERVISOR', 'MEMBER']),
  month: z.string(),
  member: memberDashboard.optional(),
  supervisor: supervisorDashboard.optional(),
  admin: adminDashboard.optional(),
});

export type Dashboard = z.infer<typeof dashboardSchema>;
