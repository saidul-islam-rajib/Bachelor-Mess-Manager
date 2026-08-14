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
