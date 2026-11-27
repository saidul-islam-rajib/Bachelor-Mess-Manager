import { request } from '@/core/api/client';
import {
  bazarScheduleSchema,
  expenseCommentResponseSchema,
  expenseDeletedSchema,
  expenseSaveResponseSchema,
  expensesMonthSchema,
  type ItemInput,
} from './schemas';

export const fetchSchedule = (groupId: string, month: string) =>
  request(`/api/groups/${groupId}/bazar-schedule?month=${month}`, bazarScheduleSchema);

export const saveAssignment = (groupId: string, month: string, day: number, userId: string | null) =>
  request(`/api/groups/${groupId}/bazar-schedule?month=${month}`, bazarScheduleSchema, {
    method: 'PUT',
    body: { assignments: [{ day, userId }] },
  });

export const fetchExpenses = (groupId: string, month: string) =>
  request(`/api/groups/${groupId}/expenses?month=${month}`, expensesMonthSchema);

export const createExpense = (groupId: string, body: { date: string; items: ItemInput[]; note?: string }) =>
  request(`/api/groups/${groupId}/expenses`, expenseSaveResponseSchema, { method: 'POST', body });

export const updateExpense = (id: string, body: { date?: string; items?: ItemInput[]; note?: string }) =>
  request(`/api/expenses/${id}`, expenseSaveResponseSchema, { method: 'PATCH', body });

export const deleteExpense = (id: string) => request(`/api/expenses/${id}`, expenseDeletedSchema, { method: 'DELETE' });

export const addComment = (id: string, text: string) =>
  request(`/api/expenses/${id}/comments`, expenseCommentResponseSchema, { method: 'POST', body: { text } });
