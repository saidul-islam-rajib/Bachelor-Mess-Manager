import { atom } from 'jotai';

export const expenseListAtom = atom<Array<{ id: string; type: string; amount: number; date: string }>>([]);
