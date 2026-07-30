import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', ['GET', 'HEAD']);
    return res.status(405).end();
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ status: 'live', uptime: Math.floor(process.uptime()) });
}
