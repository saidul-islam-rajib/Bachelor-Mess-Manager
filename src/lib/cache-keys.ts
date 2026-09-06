export const SESSION_USER_CACHE_PREFIX = 'session-user:';

export function sessionUserKey(userId: string): string {
  return `${SESSION_USER_CACHE_PREFIX}${userId}`;
}

export const BILLS_LIST_CACHE_PREFIX = 'bills-list:';

export function billsListGroupPrefix(groupId: string): string {
  return `${BILLS_LIST_CACHE_PREFIX}${groupId}:`;
}

export function billsListKey(groupId: string, month: string): string {
  return `${billsListGroupPrefix(groupId)}${month}`;
}

export const DASHBOARD_GROUP_CACHE_PREFIX = 'dashboard-group:';

export function dashboardGroupPrefix(groupId: string): string {
  return `${DASHBOARD_GROUP_CACHE_PREFIX}${groupId}:`;
}

export function dashboardGroupKey(groupId: string, month: string): string {
  return `${dashboardGroupPrefix(groupId)}${month}`;
}

export const ADVANCES_CACHE_PREFIX = 'advances:';

export function advancesKey(groupId: string): string {
  return `${ADVANCES_CACHE_PREFIX}${groupId}`;
}
