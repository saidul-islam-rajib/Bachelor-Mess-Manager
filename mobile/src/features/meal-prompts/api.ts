import { request } from '@/core/api/client';
import { answerResponse, planResponse, promptsResponse, summarySchema, type Counts } from './schemas';

export const fetchPrompts = () => request('/api/meal-prompts', promptsResponse);

export const answerPrompt = (groupId: string, date: string, answer: 'YES' | 'NO' | 'CUSTOM', counts?: Counts) =>
  request('/api/meal-prompts', answerResponse, {
    method: 'POST',
    body: { groupId, date, answer, ...(counts ? { counts } : {}) },
  });

export const fetchPlan = (groupId: string) => request(`/api/groups/${groupId}/meal-plan`, planResponse);

export const fetchSummary = (groupId: string, month: string) =>
  request(`/api/groups/${groupId}/meal-summary?month=${month}`, summarySchema);
