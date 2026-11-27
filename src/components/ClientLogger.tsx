import { useEffect } from 'react';
import { installClientLog } from '@/lib/client-log';

export default function ClientLogger() {
  useEffect(() => installClientLog(), []);
  return null;
}
