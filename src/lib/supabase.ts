import { createClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Client Supabase unique. Uniquement la clé publique (publishable/anon) :
 * la sécurité repose sur les règles RLS en base.
 */
export const supabase = env
  ? createClient(env.supabaseUrl, env.supabaseKey, {
      auth: {
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: 'spectra-auth',
      },
    })
  : null

export function requireSupabase() {
  if (!supabase)
    throw new Error('Supabase non configuré (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).')
  return supabase
}
