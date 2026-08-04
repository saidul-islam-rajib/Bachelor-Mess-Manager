export const ROUTES = {
  home: '/',
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    setPassword: '/auth/set-password'
  },
  dashboard: '/dashboard',
  meals: '/meals',
  expenses: '/expenses',
  bills: '/bills',
  payments: '/payments',
  members: '/members',
  profile: '/profile',
  comments: '/comments',
  community: '/community',
  notifications: '/notifications',
  mealReply: '/meal-reply',
  admin: '/admin',
  invitations: '/invitations',
  guide: '/guide'
};

export const MESS_COMMENTS_ANCHOR = 'mess-comments';

export function groupPath(groupId: string): string {
  return `${ROUTES.members}?group=${encodeURIComponent(groupId)}`;
}

export function commentsAnchorPath(groupId?: string): string {
  const base = groupId ? groupPath(groupId) : ROUTES.members;
  return `${base}#${MESS_COMMENTS_ANCHOR}`;
}

export function mealReplyPath(token: string, answer?: string): string {
  const query = answer ? `?answer=${encodeURIComponent(answer)}` : '';
  return `${ROUTES.mealReply}/${encodeURIComponent(token)}${query}`;
}

export function mealReplyApiPath(token: string): string {
  return `/api${ROUTES.mealReply}/${encodeURIComponent(token)}`;
}
