import { request } from '@/core/api/client';
import {
  editWindowResponseSchema,
  mealChangeCancelledSchema,
  mealSaveResponseSchema,
  mealsMonthSchema,
  type MealCounts,
} from './schemas';

export const fetchMeals = (groupId: string, month: string) =>
  request(`/api/groups/${groupId}/meals?month=${month}`, mealsMonthSchema);

export const saveMeals = (groupId: string, date: string, counts: MealCounts, reason?: string) =>
  request(`/api/groups/${groupId}/meals`, mealSaveResponseSchema, {
    method: 'PUT',
    body: { date, ...counts, ...(reason ? { reason } : {}) },
  });

export const openEditWindow = (groupId: string) =>
  request(`/api/groups/${groupId}/meal-edit-window`, editWindowResponseSchema, { method: 'POST' });

export const closeEditWindow = (groupId: string) =>
  request(`/api/groups/${groupId}/meal-edit-window`, editWindowResponseSchema, { method: 'DELETE' });

export const withdrawChange = (id: string) =>
  request(`/api/meal-changes/${id}`, mealChangeCancelledSchema, { method: 'DELETE' });
