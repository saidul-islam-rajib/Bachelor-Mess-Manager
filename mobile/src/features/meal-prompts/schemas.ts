import { z } from 'zod';

const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const counts = z.object({ breakfast: z.number(), lunch: z.number(), dinner: z.number() });

export const promptCard = z.object({
  groupId: z.string(),
  groupName: z.string(),
  date: dayKey,
  counts,
  planned: counts,
  answer: z.enum(['YES', 'NO', 'CUSTOM']).nullable(),
  respondedAt: z.string().nullable(),
});

export const promptsResponse = z.object({ date: z.string(), prompts: z.array(promptCard) });

export const answerResponse = z.object({ saved: z.boolean(), counts, summary: z.string() });

const planDay = z.object({
  weekday: z.number(),
  enabled: z.boolean(),
  breakfast: z.number(),
  lunch: z.number(),
  dinner: z.number(),
});

export const planResponse = z.object({
  plan: z.object({ isActive: z.boolean(), startDate: z.string(), days: z.array(planDay) }),
});

export const summarySchema = z.object({
  rateMode: z.string(),
  through: z.string(),
  weights: counts,
  days: z.array(
    z.object({
      date: z.string(),
      meals: z.number(),
      expense: z.number(),
      perMealPrice: z.number(),
      runningRate: z.number(),
      buyers: z.array(z.object({ id: z.string(), name: z.string(), amount: z.number() })),
    }),
  ),
  members: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      meals: z.number(),
      breakfasts: z.number(),
      lunches: z.number(),
      dinners: z.number(),
      cost: z.number(),
      paid: z.number(),
      balance: z.number(),
      isActive: z.boolean(),
    }),
  ),
  totals: z.object({
    expense: z.number(),
    meals: z.number(),
    cost: z.number(),
    mealRate: z.number(),
    averageDayRate: z.number(),
    pricedDays: z.number(),
    memberCount: z.number(),
  }),
});

export type PromptCardData = z.infer<typeof promptCard>;
export type MealPlanData = z.infer<typeof planResponse>['plan'];
export type MealSummaryData = z.infer<typeof summarySchema>;
export type Counts = z.infer<typeof counts>;
