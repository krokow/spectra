import { z } from 'zod'

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
export const RECOVERY_CODE_RE = /^[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}$/

/** Règles de mot de passe identiques à la configuration Supabase (10+, minuscule, majuscule, chiffre). */
export const PASSWORD_RULES = [
  { id: 'length', test: (p: string) => p.length >= 10 },
  { id: 'lower', test: (p: string) => /[a-z]/.test(p) },
  { id: 'upper', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'digit', test: (p: string) => /[0-9]/.test(p) },
] as const

export const passwordSchema = z
  .string()
  .max(72)
  .refine((p) => PASSWORD_RULES.every((r) => r.test(p)), { message: 'password_weak' })

export const usernameSchema = z.string().trim().regex(USERNAME_RE, { message: 'username_format' })

export const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'email_invalid' })),
  username: usernameSchema,
  password: passwordSchema,
})
export type SignupInput = z.infer<typeof signupSchema>

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, { message: 'identifier_required' }),
  password: z.string().min(1, { message: 'password_required' }),
})

export const recoverSchema = z.object({
  identifier: z.string().trim().min(3, { message: 'identifier_required' }),
  code: z.string().trim().toUpperCase().regex(RECOVERY_CODE_RE, { message: 'code_format' }),
  newPassword: passwordSchema,
})

export const isEmail = (identifier: string) => identifier.includes('@')
