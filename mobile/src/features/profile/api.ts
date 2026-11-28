import { request } from '@/core/api/client';
import {
  profilePatchSchema,
  roleRequestCreatedSchema,
  roleRequestsSchema,
  siteSettingsSchema,
  userProfileSchema,
  type Theme,
} from './schemas';

export const PROFILE_KEY = ['profile'] as const;
export const ROLE_REQUESTS_KEY = ['role-requests'] as const;

export const fetchProfile = (userId: string) => request(`/api/users/${userId}/profile`, userProfileSchema);
export const fetchSiteSettings = () => request('/api/settings', siteSettingsSchema);
export const patchProfile = (body: {
  name?: string;
  phone?: string | null;
  theme?: Theme;
  password?: string;
  currentPassword?: string;
}) => request('/api/profile', profilePatchSchema, { method: 'PATCH', body });
export const fetchMyRoleRequests = () => request('/api/role-requests?scope=mine', roleRequestsSchema);
export const createRoleRequest = (requestedRole: 'SUPERVISOR' | 'MEMBER', reason: string) =>
  request('/api/role-requests', roleRequestCreatedSchema, {
    method: 'POST',
    body: reason.trim() ? { requestedRole, reason: reason.trim() } : { requestedRole },
  });
