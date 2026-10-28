import { Loader2, Pause, Play } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CatalogTrack } from '@/providers/types'
import { cn } from '@/lib/utils'
import { Cover } from './Cover'
import { usePlayer } from './store'

export function TrackRow({ track, queue }: { track: CatalogTrack; queue: CatalogTrack[] }) {
  const { t } = useTranslation()
  const current = usePlayer((s) => s.queue[s.index]?.id === track.id)
  const status = usePlayer((s) => s.status)
  const play = usePlayer((s) => s.play)
  const playing = current && status === 'playing'
  return (
    <li>
      <button
        type="button"
        onClick={() => play(track, queue)}
        aria-label={
          playing
            ? t('player.pauseTrack', { title: track.title })
            : t('player.playTrack', { title: track.title, artist: track.artist_name })
        }
        aria-pressed={current}
        className={cn(
          'group flex w-full items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-surface',
          current && 'bg-surface',
        )}
      >
        <span className="relative size-14 shrink-0 overflow-hidden rounded-md">
          <Cover src={track.cover_url} alt="" className="size-full" />
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/45 text-white transition-opacity',
              current
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
            aria-hidden
          >
            {current && status === 'loading' ? (
              <Loader2 className="size-6 animate-spin" />
            ) : playing ? (
              <Pause className="size-6" />
            ) : (
              <Play className="size-6" />
            )}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block truncate font-semibold', current && 'text-spectrum')}>
            {track.title}
          </span>
          <span className="block truncate text-sm text-fg-muted">
            {track.artist_name}
            {track.release_year ? ` · ${track.release_year}` : ''}
          </span>
        </span>
      </button>
    </li>
  )
}
