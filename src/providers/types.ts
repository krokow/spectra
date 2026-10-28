import { z } from 'zod'

/** Morceau tel que renvoyé par le catalogue (table `tracks` / Edge Function `music`). */
export const CatalogTrack = z.object({
  id: z.uuid(),
  title: z.string(),
  artist_name: z.string(),
  album: z.string().nullable().optional(),
  cover_url: z.string().nullable().optional(),
  duration_s: z.number().nullable().optional(),
  release_year: z.number().nullable().optional(),
  deezer_id: z.number().nullable().optional(),
  itunes_id: z.number().nullable().optional(),
  preview_url: z.string().nullable().optional(),
  preview_source: z.enum(['deezer', 'itunes']).nullable().optional(),
  preview_expires_at: z.string().nullable().optional(),
  explicit: z.boolean().optional(),
})
export type CatalogTrack = z.infer<typeof CatalogTrack>

/** Caractéristiques utiles au lecteur (forme de la waveform). Toutes facultatives. */
export type TrackFeatures = Partial<Record<'energy' | 'tempo' | 'dance' | 'bass', number>>

/**
 * Source musicale interchangeable. L'implémentation par défaut passe par
 * l'Edge Function `music` (Deezer + iTunes + Last.fm) ; une autre pourrait
 * être branchée sans toucher au lecteur ni aux écrans.
 */
export interface MusicProvider {
  search(query: string): Promise<CatalogTrack[]>
  /** Renvoie le morceau avec une URL d'extrait valide (rafraîchie si besoin). */
  ensurePreview(track: CatalogTrack): Promise<CatalogTrack>
}

/** Une URL d'extrait est-elle encore utilisable pendant au moins `marginMs` ? */
export function previewIsFresh(track: CatalogTrack, now = Date.now(), marginMs = 60_000): boolean {
  if (!track.preview_url || !track.preview_expires_at) return false
  return Date.parse(track.preview_expires_at) - now > marginMs
}

/** Lien vers la page du morceau chez la source de l'extrait (attribution obligatoire). */
export function sourceLink(track: CatalogTrack): { label: string; href: string } | null {
  if (track.preview_source === 'deezer' && track.deezer_id) {
    return { label: 'Deezer', href: `https://www.deezer.com/track/${track.deezer_id}` }
  }
  if (track.preview_source === 'itunes' && track.itunes_id) {
    return { label: 'Apple Music', href: `https://music.apple.com/song/${track.itunes_id}` }
  }
  return null
}
