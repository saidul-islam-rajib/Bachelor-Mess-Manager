import { atom } from 'jotai';

export const currentGroupAtom = atom<string | null>(null);
export const groupListAtom = atom<Array<{ id: string; name: string }>>([]);
