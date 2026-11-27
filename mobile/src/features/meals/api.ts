import { request } from '@/core/api/client';
import {
  editWindowResponseSchema,
  mealChangeCancelledSchema,
  mealChangeResponseSchema,
  mealSaveResponseSchema,
  mealsMonthSchema,
  type MealCounts,
} from './schemas';

export const fetchMeals = (groupId: string, month: string) =>
  request(`/api/groups/${groupId}/meals?month=${month}`, mealsMonthSchema);

export const saveMeals = (groupId: string, date: string, counts: MealCounts, options: { reason?: string; userId?: string } = {}) =>
  request(`/api/groups/${groupId}/meals`, mealSaveResponseSchema, {
    method: 'PUT',
    body: { date, ...counts, ...(options.userId ? { userId: options.userId } : {}), ...(options.reason ? { reason: options.reason } : {}) },
  });

export const decideChange = (id: string, status: 'APPROVED' | 'REJECTED') =>
  request(`/api/meal-changes/${id}`, mealChangeResponseSchema, { method: 'PATCH', body: { status } });

export const openEditWindow = (groupId: string) =>
  request(`/api/groups/${groupId}/meal-edit-window`, editWindowResponseSchema, { method: 'POST' });

export const closeEditWindow = (groupId: string) =>
  request(`/api/groups/${groupId}/meal-edit-window`, editWindowResponseSchema, { method: 'DELETE' });

export const withdrawChange = (id: string) =>
  request(`/api/meal-changes/${id}`, mealChangeCancelledSchema, { method: 'DELETE' });
