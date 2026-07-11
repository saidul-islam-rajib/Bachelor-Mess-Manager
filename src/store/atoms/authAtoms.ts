import { atom } from 'jotai';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const authUserAtom = atom<AuthUser | null>(null);
export const authTokenAtom = atom<string | null>(null);
export const isAuthenticatedAtom = atom((get) => Boolean(get(authUserAtom)));
