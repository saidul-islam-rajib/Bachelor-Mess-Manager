import { traced } from '@/lib/log';
import { allocate } from '@/lib/settlement';

function allocateMealCostsImpl(
  memberCount: number,
  totalBazarPaisa: number,
  daily: boolean,
  pricedByDay: Map<string, number>,
  unitsByDay: Map<string, Map<number, number>>,
  unitsByMember: ArrayLike<number>
): number[] {
  const costs: number[] = new Array(memberCount).fill(0);
  let dayPricedPaisa = 0;

  if (daily) {
    for (const [day, paisa] of pricedByDay) {
      const dayUnits = unitsByDay.get(day);
      if (!dayUnits || paisa <= 0) continue;
      const entries = [...dayUnits.entries()];
      const shares = allocate(paisa, entries.map(([, units]) => units));
      entries.forEach(([index], i) => {
        costs[index] += shares[i];
      });
      dayPricedPaisa += paisa;
    }
  }

  const pooledPaisa = totalBazarPaisa - dayPricedPaisa;
  const memberUnits = Array.from(unitsByMember);
  const totalUnits = memberUnits.reduce((a, b) => a + b, 0);

  if (pooledPaisa !== 0) {
    if (totalUnits > 0) {
      const shares = allocate(pooledPaisa, memberUnits);
      shares.forEach((share, i) => {
        costs[i] += share;
      });
    } else if (memberCount > 0) {
      const shares = allocate(pooledPaisa, memberUnits.map(() => 1));
      shares.forEach((share, i) => {
        costs[i] += share;
      });
    }
  }

  return costs;
}

export const allocateMealCosts = traced('allocateMealCosts', allocateMealCostsImpl);
