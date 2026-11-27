import { request } from '@/core/api/client';
import { closeMonthSchema, closingListSchema, closingReopenedSchema, finalSettlementResponseSchema } from './schemas';

export const fetchClosings = (groupId: string) => request(`/api/groups/${groupId}/closings`, closingListSchema);

export const closeMonth = (groupId: string, body: { month: string }) =>
  request(`/api/groups/${groupId}/closings`, closeMonthSchema, { method: 'POST', body });

export const reopenClosing = (id: string) => request(`/api/closings/${id}`, closingReopenedSchema, { method: 'DELETE' });

export const fetchFinalSettlement = (groupId: string) => request(`/api/groups/${groupId}/final-settlement`, finalSettlementResponseSchema);

export const runFinalSettlement = (groupId: string, body: { action: 'settleMember' | 'settleAll' | 'markSettled'; userId?: string }) =>
  request(`/api/groups/${groupId}/final-settlement`, finalSettlementResponseSchema, { method: 'POST', body });
