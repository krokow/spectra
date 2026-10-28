import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { requireSupabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/authContext'

export const Visibility = z.enum(['public', 'friends', 'private'])
export type Visibility = z.infer<typeof Visibility>

const Profile = z.object({
  id: z.uuid(),
  username: z.string(),
  display_name: z.string().nullable(),
  avatar_seed: z.string(),
  created_at: z.string(),
})
export type Profile = z.infer<typeof Profile>

const Settings = z.object({
  locale: z.enum(['fr', 'en']),
  profile_visibility: Visibility,
  stats_visibility: Visibility,
  activity_visibility: Visibility,
  searchable: z.boolean(),
  twins_opt_in: z.boolean(),
  birth_year: z.number().int().nullable(),
})
export type Settings = z.infer<typeof Settings>

function must(uid: string | undefined): string {
  if (!uid) throw new Error('Connexion requise.')
  return uid
}

export const profileKeys = {
  me: (uid: string | undefined) => ['profile', 'me', uid] as const,
  settings: (uid: string | undefined) => ['profile', 'settings', uid] as const,
  recoveryRemaining: (uid: string | undefined) => ['profile', 'recovery', uid] as const,
}

export function useMyProfile() {
  const uid = useAuth().session?.user.id
  return useQuery({
    queryKey: profileKeys.me(uid),
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('profiles')
        .select('id, username, display_name, avatar_seed, created_at')
        .eq('id', must(uid))
        .single()
      if (error) throw error
      return Profile.parse(data)
    },
  })
}

export function useMySettings() {
  const uid = useAuth().session?.user.id
  return useQuery({
    queryKey: profileKeys.settings(uid),
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await requireSupabase()
        .from('profile_settings')
        .select(
          'locale, profile_visibility, stats_visibility, activity_visibility, searchable, twins_opt_in, birth_year',
        )
        .eq('user_id', must(uid))
        .single()
      if (error) throw error
      return Settings.parse(data)
    },
  })
}

export function useUpdateProfile() {
  const uid = useAuth().session?.user.id
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Pick<Profile, 'display_name' | 'avatar_seed'>>) => {
      const { error } = await requireSupabase().from('profiles').update(patch).eq('id', must(uid))
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.me(uid) }),
  })
}

export function useUpdateSettings() {
  const uid = useAuth().session?.user.id
  const qc = useQueryClient()
  const key = profileKeys.settings(uid)
  return useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { error } = await requireSupabase()
        .from('profile_settings')
        .update(patch)
        .eq('user_id', must(uid))
      if (error) throw error
    },
    // UI optimiste : le réglage bascule tout de suite, et revient en arrière en cas d'erreur.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Settings>(key)
      if (previous) qc.setQueryData<Settings>(key, { ...previous, ...patch })
      return { previous }
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

/** Affichage seulement : chaque action d'administration est vérifiée côté serveur (RLS). */
export function useIsAdmin() {
  const uid = useAuth().session?.user.id
  return useQuery({
    queryKey: ['profile', 'is-admin', uid],
    enabled: !!uid,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('is_admin')
      if (error) throw error
      return z.boolean().parse(data)
    },
  })
}

export function useRecoveryRemaining() {
  const uid = useAuth().session?.user.id
  return useQuery({
    queryKey: profileKeys.recoveryRemaining(uid),
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await requireSupabase().rpc('recovery_codes_remaining')
      if (error) throw error
      return z.number().int().parse(data)
    },
  })
}

export async function generateRecoveryCodes(): Promise<string[]> {
  const { data, error } = await requireSupabase().rpc('generate_recovery_codes')
  if (error) throw error
  return z.array(z.string()).length(8).parse(data)
}

export async function exportMyData(): Promise<unknown> {
  const { data, error } = await requireSupabase().rpc('export_my_data')
  if (error) throw error
  return data
}

export async function deleteMyAccount(confirmUsername: string): Promise<void> {
  const sb = requireSupabase()
  const { error } = await sb.rpc('delete_my_account', { p_confirm_username: confirmUsername })
  if (error) throw error
  await sb.auth.signOut({ scope: 'local' })
}
