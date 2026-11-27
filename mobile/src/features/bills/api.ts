import { request } from '@/core/api/client';
import {
  billDeletedSchema,
  billSavedSchema,
  billsMonthSchema,
  collectionCreatedSchema,
  collectionRemovedSchema,
} from './schemas';

export type BillInput = { type: string; amount: number; date: string; note: string };

export const fetchBills = (groupId: string, month: string) =>
  request(`/api/groups/${groupId}/bills?month=${month}`, billsMonthSchema);

export const createBill = (groupId: string, body: BillInput) =>
  request(`/api/groups/${groupId}/bills`, billSavedSchema, { method: 'POST', body: { ...body, splitMethod: 'EQUAL' } });

export const updateBill = (id: string, body: Partial<BillInput>) =>
  request(`/api/bills/${id}`, billSavedSchema, { method: 'PATCH', body });

export const deleteBill = (id: string) => request(`/api/bills/${id}`, billDeletedSchema, { method: 'DELETE' });

export const settleShare = (billId: string, userId: string) =>
  request(`/api/bills/${billId}/collections`, collectionCreatedSchema, { method: 'POST', body: { userId, settle: true } });

export const recordCollection = (billId: string, userId: string, amount: number) =>
  request(`/api/bills/${billId}/collections`, collectionCreatedSchema, { method: 'POST', body: { userId, amount } });

export const reverseCollection = (billId: string, collectionId: string) =>
  request(`/api/bills/${billId}/collections?collectionId=${collectionId}`, collectionRemovedSchema, { method: 'DELETE' });
