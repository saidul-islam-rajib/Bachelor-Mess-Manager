import { request } from '@/core/api/client';
import { dashboardSchema } from './schemas';

export const fetchDashboard = () => request('/api/reports/dashboard', dashboardSchema);
