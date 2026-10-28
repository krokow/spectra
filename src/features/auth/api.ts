import { z } from 'zod'
import i18n from '@/i18n'
import { requireSupabase } from '@/lib/supabase'
import { isEmail, type SignupInput } from '@/schemas/auth'
import { setPostAuthTarget } from './postAuth'

export class AuthFailure extends Error {
  constructor(public readonly key: string) {
    super(key)
  }
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await requireSupabase().rpc('username_available', {
    p_username: username,
  })
  if (error) throw error
  return z.boolean().parse(data)
}

export async function signUp(input: SignupInput) {
  // Première étape après l'inscription : les codes de secours.
  setPostAuthTarget({ path: '/codes', state: { firstTime: true } })
  const { data, error } = await requireSupabase().auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { username: input.username, locale: i18n.language === 'en' ? 'en' : 'fr' } },
  })
  if (error) {
    setPostAuthTarget(null)
    throw error
  }
  // « Confirm email » est désactivé côté Supabase : la session doit arriver tout de suite.
  if (!data.session) throw new AuthFailure('confirmation_enabled')
  return data.session
}

/** Connexion avec un e-mail OU un pseudo. */
export async function signIn(identifier: string, password: string) {
  const sb = requireSupabase()
  let email = identifier.trim()
  if (!isEmail(email)) {
    // Le serveur ne renvoie l'e-mail que si le mot de passe est correct.
    const { data, error } = await sb.rpc('login_email_for', {
      p_username: email,
      p_password: password,
    })
    if (error) throw error
    const found = z.string().nullable().parse(data)
    if (!found) throw new AuthFailure('invalid_credentials')
    email = found
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data.session
}

export async function recoverAccount(input: {
  identifier: string
  code: string
  newPassword: string
}) {
  const { data, error } = await requireSupabase().functions.invoke('account-recover', {
    body: input,
  })
  if (error) {
    // L'Edge Function renvoie { error: '<clé>' } avec un statut 4xx.
    const ctx = (error as { context?: Response }).context
    const body = ctx ? await ctx.json().catch(() => null) : null
    const key = z.object({ error: z.string() }).safeParse(body)
    throw new AuthFailure(key.success ? key.data.error : 'network')
  }
  return z.object({ ok: z.literal(true) }).parse(data)
}

export async function signOut() {
  await requireSupabase().auth.signOut({ scope: 'local' })
}
