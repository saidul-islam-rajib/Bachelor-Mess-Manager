export const MESS_ACCESS = {
  OK: 'OK',
  NO_GROUP: 'NO_GROUP',
  GROUP_CLOSED: 'GROUP_CLOSED',
  MEMBERSHIP_ENDED: 'MEMBERSHIP_ENDED'
} as const;

export type MessAccessState = (typeof MESS_ACCESS)[keyof typeof MESS_ACCESS];

export type MessAccess = {
  state: MessAccessState;
  groupName: string | null;
  locked: boolean;
};

export const OPEN_ACCESS: MessAccess = { state: MESS_ACCESS.OK, groupName: null, locked: false };
