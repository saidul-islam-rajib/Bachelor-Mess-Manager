import { atom } from 'jotai';

export const commentListAtom = atom<Array<{ id: string; userId: string; text: string; reply?: string; createdAt: string }>>([]);
