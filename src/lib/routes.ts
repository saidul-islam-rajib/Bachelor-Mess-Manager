export const ROUTES = {
  home: '/',
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    setPassword: '/auth/set-password'
  },
  dashboard: '/dashboard',
  groups: '/groups',
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

export function mealReplyPath(token: string, answer?: string): string {
  const query = answer ? `?answer=${encodeURIComponent(answer)}` : '';
  return `${ROUTES.mealReply}/${encodeURIComponent(token)}${query}`;
}

export function mealReplyApiPath(token: string): string {
  return `/api${ROUTES.mealReply}/${encodeURIComponent(token)}`;
}
