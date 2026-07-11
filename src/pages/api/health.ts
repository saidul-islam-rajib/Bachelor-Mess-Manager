import type { NextApiRequest, NextApiResponse } from 'next';
import { withAudit } from '@/lib/with-audit';

function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ status: 'ok' });
}

export default withAudit(handler);
