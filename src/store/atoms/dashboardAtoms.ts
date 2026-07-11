import { atom } from 'jotai';

export const dashboardDataAtom = atom({
  totalMeals: 0,
  totalCost: 0,
  totalMembers: 0,
  unpaidCount: 0,
  dueAmount: 0
});
