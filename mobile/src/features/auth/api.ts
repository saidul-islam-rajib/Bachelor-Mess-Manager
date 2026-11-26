import { request } from '@/core/api/client';
import { loginResponseSchema, okSchema } from './schemas';

export const login = (email: string, password: string) =>
  request('/api/mobile/v1/auth/login', loginResponseSchema, {
    method: 'POST',
    body: { email, password },
    auth: false,
  });

export const logout = () =>
  request('/api/mobile/v1/auth/logout', okSchema, { method: 'POST' });
