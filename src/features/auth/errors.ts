import { AuthFailure } from './api'

/** Clé i18n (auth.errors.*) d'une erreur, sans jamais exposer de détail technique. */
export function authErrorKey(error: unknown): string {
  if (error instanceof AuthFailure) return error.key
  if (!(error instanceof Error) && !(typeof error === 'object' && error && 'message' in error))
    return 'unknown'
  const e = error as { message: string; code?: unknown; status?: unknown; hint?: unknown }
  const code = String(e.code ?? '')
  const status = Number(e.status ?? 0)
  const msg = String(e.message).toLowerCase()
  if (
    code === 'PT429' ||
    e.hint === 'rate_limited' ||
    status === 429 ||
    code.includes('rate_limit') ||
    msg.includes('trop de tentatives')
  )
    return 'rate_limited'
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials'))
    return 'invalid_credentials'
  if (
    code === 'user_already_exists' ||
    code === 'email_exists' ||
    msg.includes('already registered')
  )
    return 'email_taken'
  if (code === 'weak_password') return 'weak_password'
  if (msg.includes('pseudo invalide') || msg.includes('database error saving new user'))
    return 'username_taken'
  if (msg.includes('failed to fetch') || msg.includes('network')) return 'network'
  return 'unknown'
}
