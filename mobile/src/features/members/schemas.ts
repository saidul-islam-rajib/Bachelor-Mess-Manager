import { z } from 'zod';

export const supervisorInfoSchema = z.object({
  supervisors: z.array(z.object({ id: z.string(), name: z.string(), email: z.string(), isPrimary: z.boolean() })),
  maxSupervisors: z.number(),
  siteMaxSupervisors: z.number(),
  overriddenByGroup: z.boolean(),
  canAddMore: z.boolean(),
});

export const memberSchema = z.object({
  membershipId: z.string(),
  id: z.string(),
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  profileImage: z.string().nullable(),
  isActive: z.boolean(),
  isSupervisor: z.boolean(),
  isCoSupervisor: z.boolean(),
  joinedAt: z.string(),
  leftAt: z.string().nullable(),
  stayDays: z.number(),
});

export const membersResponseSchema = z.object({
  canManage: z.boolean(),
  isAdmin: z.boolean(),
  supervisors: supervisorInfoSchema,
  members: z.array(memberSchema),
});

export const memberDetailSchema = z.object({
  monthKey: z.string(),
  canManage: z.boolean(),
  isSelf: z.boolean(),
  member: z.object({ id: z.string(), name: z.string(), email: z.string(), phone: z.string().nullable(), isActive: z.boolean(), stayDays: z.number() }),
  money: z.object({ totalCost: z.number(), collected: z.number(), due: z.number() }),
  meals: z.object({ total: z.number() }),
});

const person = z.object({ id: z.string(), name: z.string(), email: z.string() });

export const groupInvitationsSchema = z.object({
  invitations: z.array(z.object({ id: z.string(), status: z.string(), invitee: person })),
});

export const myInvitationsSchema = z.object({
  invitations: z.array(z.object({ id: z.string(), status: z.string(), group: z.object({ id: z.string(), name: z.string() }), inviter: person })),
});

export const invitedSchema = z.object({ resent: z.boolean(), warning: z.string().nullable() });
export const invitationAnswerSchema = z.object({ invitation: z.object({ id: z.string(), status: z.string() }) });
export const cancelledSchema = z.object({ cancelled: z.boolean() });
export const membershipSchema = z.object({ membership: z.object({ id: z.string(), isActive: z.boolean() }) });
export const removedSchema = z.object({ removed: z.boolean(), left: z.boolean() });
export const handoverSchema = z.object({ supervisor: person });

export type Member = z.infer<typeof memberSchema>;
