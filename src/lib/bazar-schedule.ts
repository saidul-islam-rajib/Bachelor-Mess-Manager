export type BazarDayAssignment = {
  day: number;
  userId: string;
};

export function computeEqualSplitDays(orderedUserIds: string[], totalDays: number): BazarDayAssignment[] {
  const n = orderedUserIds.length;
  if (n === 0 || totalDays <= 0) return [];

  const base = Math.floor(totalDays / n);
  const remainder = totalDays % n;
  const assignments: BazarDayAssignment[] = [];
  let day = 1;

  orderedUserIds.forEach((userId, index) => {
    const count = base + (index < remainder ? 1 : 0);
    for (let i = 0; i < count; i++) {
      assignments.push({ day, userId });
      day += 1;
    }
  });

  return assignments;
}
