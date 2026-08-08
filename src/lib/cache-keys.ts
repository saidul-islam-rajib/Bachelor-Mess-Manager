export const SESSION_USER_CACHE_PREFIX = 'session-user:';

export function sessionUserKey(userId: string): string {
  return `${SESSION_USER_CACHE_PREFIX}${userId}`;
}
