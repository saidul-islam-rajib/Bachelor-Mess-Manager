import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { withAudit } from '@/lib/with-audit';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const [mealSum, expenseSum, memberCount, unpaidCount, overdueSum] = await Promise.all([
    prisma.mealEntry.aggregate({ _sum: { totalMeals: true } }),
    prisma.expenseEntry.aggregate({ _sum: { amount: true } }),
    prisma.membership.count({ where: { isActive: true } }),
    prisma.paymentStatus.count({ where: { status: { in: ['PENDING', 'PARTIAL'] } } }),
    prisma.paymentStatus.aggregate({
      _sum: {
        amountDue: true,
        amountPaid: true
      },
      where: { status: { in: ['PENDING', 'PARTIAL'] } }
    })
  ]);

  const totalMeals = mealSum._sum.totalMeals ?? 0;
  const totalCost = expenseSum._sum.amount ?? 0;
  const totalMembers = memberCount;
  const unpaidAmount = (overdueSum._sum.amountDue ?? 0) - (overdueSum._sum.amountPaid ?? 0);

  return res.status(200).json({ report: {
    totalMeals,
    totalCost,
    totalMembers,
    unpaidCount,
    unpaidAmount: Math.max(0, unpaidAmount)
  } });
}

export default withAudit(handler);
