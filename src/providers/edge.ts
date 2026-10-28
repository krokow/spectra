import { z } from 'zod'
import { requireSupabase } from '@/lib/supabase'
import { CatalogTrack, previewIsFresh, type MusicProvider } from './types'

export class MusicError extends Error {
  constructor(public readonly key: string) {
    super(key)
  }
}

async function invoke<T>(body: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await requireSupabase().functions.invoke('music', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const payload = ctx ? await ctx.json().catch(() => null) : null
    const parsed = z.object({ error: z.string() }).safeParse(payload)
    // 404 sans corps JSON : la fonction n'est pas (encore) déployée.
    throw new MusicError(
      parsed.success ? parsed.data.error : ctx?.status === 404 ? 'not_deployed' : 'network',
    )
  }
  return schema.parse(data)
}

export const edgeProvider: MusicProvider = {
  async search(query) {
    const res = await invoke(
      { action: 'search', q: query },
      z.object({ tracks: z.array(CatalogTrack) }),
    )
    return res.tracks
  },
  async ensurePreview(track) {
    if (previewIsFresh(track)) return track
    const res = await invoke(
      { action: 'preview', trackId: track.id },
      z.object({ track: CatalogTrack }),
    )
    return res.track
  },
}
