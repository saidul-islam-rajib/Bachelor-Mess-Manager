import { z } from 'zod';

export const themeSchema = z.enum(['system', 'light', 'dark']);

export const profileUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  phone: z.string().nullable(),
  profileImage: z.string().nullable(),
  theme: themeSchema,
});

export const profilePatchSchema = z.object({
  user: profileUserSchema,
  passwordChanged: z.boolean(),
});

export const userProfileSchema = z.object({
  member: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    phone: z.string().nullable(),
    profileImage: z.string().nullable(),
    role: z.string(),
    status: z.string(),
    memberSince: z.string(),
    isSelf: z.boolean(),
    groups: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        status: z.string(),
        isSupervisor: z.boolean(),
        isActive: z.boolean(),
        joinedAt: z.string(),
        leftAt: z.string().nullable(),
        stayDays: z.number(),
      }),
    ),
  }),
});

export const siteSettingsSchema = z.object({
  settings: z
    .object({
      companyName: z.string(),
      tagline: z.string().nullable().optional(),
      contactEmail: z.string().nullable().optional(),
      contactPhone: z.string().nullable().optional(),
    })
    .passthrough(),
});

export const roleRequestSchema = z.object({
  id: z.string(),
  requestedRole: z.enum(['SUPERVISOR', 'MEMBER']),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']),
  reason: z.string().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: z.string(),
});

export const roleRequestsSchema = z.object({
  requests: z.array(roleRequestSchema),
  canReview: z.boolean(),
  policy: z.object({ autoApproveSupervisor: z.boolean(), allowSelfRoleSwitch: z.boolean() }),
});

export const roleRequestCreatedSchema = z.object({
  requestId: z.string(),
  autoApproved: z.boolean(),
  message: z.string(),
});

export type Theme = z.infer<typeof themeSchema>;
export type RoleRequest = z.infer<typeof roleRequestSchema>;
