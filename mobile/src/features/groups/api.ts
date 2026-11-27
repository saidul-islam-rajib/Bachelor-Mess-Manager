import { z } from 'zod';
import { request } from '@/core/api/client';

const groupListSchema = z.object({
  groups: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type GroupSummary = z.infer<typeof groupListSchema>['groups'][number];

export const fetchGroups = () => request('/api/groups', groupListSchema).then((r) => r.groups);
