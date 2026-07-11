import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const comments = await prisma.comment.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
        group: { select: { id: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.status(200).json({ comments });
  }

  if (req.method === 'POST') {
    const { email, groupId, text, replyText } = req.body as {
      email?: string;
      groupId?: string;
      text?: string;
      replyText?: string;
    };

    if (!email || !groupId || !text) {
      return res.status(400).json({ error: 'Email, group ID, and text are required.' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const comment = await prisma.comment.create({
      data: {
        userId: user.id,
        groupId: group.id,
        text,
        replyText: replyText || undefined
      }
    });

    return res.status(201).json({ comment });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
