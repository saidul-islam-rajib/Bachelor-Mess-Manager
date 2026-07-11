import { atom } from 'jotai';

export const mealDateAtom = atom<string | null>(null);
export const mealEntriesAtom = atom<Array<{ date: string; breakfast: number; lunch: number; dinner: number }>>([]);
