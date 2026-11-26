import { z } from 'zod';

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
});

export const loginResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.union([z.string(), z.number()]),
  user: userSchema,
});

export const okSchema = z.object({ ok: z.boolean() });

export type SessionUser = z.infer<typeof userSchema>;
