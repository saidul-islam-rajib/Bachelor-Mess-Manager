import { request } from '@/core/api/client';
import {
  cancelledSchema,
  groupInvitationsSchema,
  handoverSchema,
  invitationAnswerSchema,
  invitedSchema,
  memberDetailSchema,
  membersResponseSchema,
  membershipSchema,
  myInvitationsSchema,
  removedSchema,
  supervisorInfoSchema,
} from './schemas';

export const fetchMembers = (groupId: string) => request(`/api/groups/${groupId}/members`, membersResponseSchema);
export const fetchMemberDetail = (groupId: string, userId: string) => request(`/api/groups/${groupId}/members/${userId}`, memberDetailSchema);
export const setMemberActive = (groupId: string, userId: string, isActive: boolean) =>
  request(`/api/groups/${groupId}/members`, membershipSchema, { method: 'PATCH', body: { userId, isActive } });
export const removeMember = (groupId: string, userId: string) =>
  request(`/api/groups/${groupId}/members`, removedSchema, { method: 'DELETE', body: { userId } });
export const fetchGroupInvitations = (groupId: string) => request(`/api/groups/${groupId}/invitations`, groupInvitationsSchema);
export const sendInvitation = (groupId: string, email: string) =>
  request(`/api/groups/${groupId}/invitations`, invitedSchema, { method: 'POST', body: { email } });
export const fetchMyInvitations = () => request('/api/invitations', myInvitationsSchema);
export const answerInvitation = (id: string, status: 'ACCEPTED' | 'REJECTED') =>
  request(`/api/invitations/${id}`, invitationAnswerSchema, { method: 'PATCH', body: { status } });
export const cancelInvitation = (id: string) => request(`/api/invitations/${id}`, cancelledSchema, { method: 'DELETE' });
export const handOver = (groupId: string, userId: string) =>
  request(`/api/groups/${groupId}/supervisor`, handoverSchema, { method: 'POST', body: { userId } });
export const addCoSupervisor = (groupId: string, userId: string) =>
  request(`/api/groups/${groupId}/co-supervisors`, supervisorInfoSchema, { method: 'POST', body: { userId } });
export const removeCoSupervisor = (groupId: string, userId: string) =>
  request(`/api/groups/${groupId}/co-supervisors?userId=${encodeURIComponent(userId)}`, supervisorInfoSchema, { method: 'DELETE' });
