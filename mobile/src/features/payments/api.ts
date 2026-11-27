import { request } from '@/core/api/client';
import {
  advanceCreatedSchema,
  advanceReversedSchema,
  advancesSchema,
  paymentCreatedSchema,
  paymentRemovedSchema,
  paymentUpdatedSchema,
  paymentsMonthSchema,
} from './schemas';

export const fetchPayments = (groupId: string, month: string) => request(`/api/groups/${groupId}/payments?month=${month}`, paymentsMonthSchema);

export const recordPayment = (groupId: string, body: { userId: string; amount: number; date: string }) =>
  request(`/api/groups/${groupId}/payments`, paymentCreatedSchema, { method: 'POST', body });

export const updatePayment = (id: string, body: { amount?: number; date?: string }) =>
  request(`/api/payments/${id}`, paymentUpdatedSchema, { method: 'PATCH', body });

export const reversePayment = (id: string) => request(`/api/payments/${id}`, paymentRemovedSchema, { method: 'DELETE' });

export const fetchAdvances = (groupId: string) => request(`/api/groups/${groupId}/advances`, advancesSchema);

export const recordAdvance = (groupId: string, body: { userId: string; amount: number; note?: string }) =>
  request(`/api/groups/${groupId}/advances`, advanceCreatedSchema, { method: 'POST', body });

export const reverseAdvance = (groupId: string, advanceId: string) =>
  request(`/api/groups/${groupId}/advances?advanceId=${advanceId}`, advanceReversedSchema, { method: 'DELETE' });
