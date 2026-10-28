// FICHIER GÉNÉRÉ par scripts/functions/bundle.mjs : ne pas modifier à la main.
// Source : supabase/functions/account-recover/. Copier TOUT ce fichier dans l'éditeur Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { z } from 'npm:zod@4.6.7'

// ───── supabase/functions/account-recover/index.ts ─────
// Spectra · Edge Function « account-recover »
// Réinitialise un mot de passe grâce à un code de secours (aucun e-mail envoyé).
//
// Déploiement : Supabase → Edge Functions → Deploy a new function → Via Editor
//   nom : account-recover · coller ce fichier · DÉSACTIVER « Verify JWT » (l'utilisateur n'est pas connecté).
// Secret requis (Edge Functions → Secrets) : ALLOWED_ORIGINS = https://krokow.github.io
// SUPABASE_URL, SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par Supabase.




const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const Body = z.object({
  identifier: z.string().trim().min(3).max(254),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-HJ-NP-Z2-9]{4}-?[A-HJ-NP-Z2-9]{4}$/),
  newPassword: z
    .string()
    .min(10)
    .max(72) // limite bcrypt
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/[0-9]/),
})

function mustEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`)
  return v
}

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  if (!origin || !ALLOWED.includes(origin))
    return json(403, { error: 'origin_not_allowed' }, origin)
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin)

  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json(400, { error: 'invalid_input' }, origin)
  const { identifier, newPassword } = parsed.data
  const code = parsed.data.code.includes('-')
    ? parsed.data.code
    : `${parsed.data.code.slice(0, 4)}-${parsed.data.code.slice(4)}`

  const url = mustEnv('SUPABASE_URL')
  const service = createClient(url, mustEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const ip =
    (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown')
      .split(',')[0]
      ?.trim() ?? 'unknown'

  // 1. Vérifier le code (limites de débit appliquées en base, par IP et par identifiant).
  const found = await service.rpc('find_recovery_code', {
    p_identifier: identifier,
    p_code: code,
    p_ip: ip,
  })
  if (found.error) {
    const limited = found.error.code === 'PT429' || found.error.hint === 'rate_limited'
    return json(limited ? 429 : 500, { error: limited ? 'rate_limited' : 'server_error' }, origin)
  }
  const match = (found.data as { user_id: string; code_id: number }[] | null)?.[0]
  // Réponse identique que le compte existe ou non : rien à apprendre pour un attaquant.
  if (!match) return json(400, { error: 'invalid_code' }, origin)

  // 2. Changer le mot de passe via l'API d'administration officielle.
  const updated = await service.auth.admin.updateUserById(match.user_id, { password: newPassword })
  if (updated.error || !updated.data.user.email)
    return json(400, { error: 'weak_password' }, origin)

  // 3. Le code ne resservira plus.
  const consumed = await service.rpc('consume_recovery_code', { p_code_id: match.code_id })
  if (consumed.error) return json(500, { error: 'server_error' }, origin)

  // 4. Fermer toutes les sessions ouvertes (ex. un appareil volé encore connecté).
  const anon = createClient(url, mustEnv('SUPABASE_ANON_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const session = await anon.auth.signInWithPassword({
    email: updated.data.user.email,
    password: newPassword,
  })
  if (session.data.session)
    await service.auth.admin.signOut(session.data.session.access_token, 'global')

  return json(200, { ok: true }, origin)
})
