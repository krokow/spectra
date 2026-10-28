import { useQuery } from '@tanstack/react-query'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebounced } from '@/lib/useDebounced'
import { TrackRow } from '@/player/TrackRow'
import { MusicError, musicProvider } from '@/providers'

/**
 * Découvrir. Pour l'instant : recherche dans le catalogue (Deezer, secours iTunes).
 * Les recommandations et le swipe arrivent à l'étape 6.
 */
export default function DiscoverPage() {
  const { t } = useTranslation()
  const [q, setQ] = useState('')
  const query = useDebounced(q.trim(), 450)
  const results = useQuery({
    queryKey: ['search', query.toLowerCase()],
    queryFn: () => musicProvider.search(query),
    enabled: query.length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const tracks = results.data ?? []
  const errorKey = results.error instanceof MusicError ? results.error.key : 'network'

  return (
    <div className="flex flex-col gap-6 pt-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t('nav.discover')}</h1>
        <p className="text-fg-muted">{t('discover.searchIntro')}</p>
      </div>

      <search>
        <label className="relative block">
          <span className="sr-only">{t('discover.searchLabel')}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-fg-muted"
            aria-hidden
          />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('discover.searchPlaceholder')}
            maxLength={100}
            enterKeyHint="search"
            className="h-14 w-full rounded-full border border-border bg-surface pr-5 pl-12 text-base focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none"
          />
        </label>
      </search>

      {query.length < 2 ? (
        <EmptyState title={t('discover.emptyTitle')} description={t('discover.emptyText')} />
      ) : results.isPending ? (
        <ul className="flex flex-col gap-2" aria-busy aria-label={t('common.loading')}>
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="size-14 rounded-md" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </li>
          ))}
        </ul>
      ) : results.isError ? (
        <p role="alert" className="text-danger">
          {t(`player.errors.${errorKey}`)}
        </p>
      ) : tracks.length === 0 ? (
        <EmptyState
          title={t('discover.noResultTitle')}
          description={t('discover.noResultText', { q: query })}
        />
      ) : (
        <ul
          className="grid gap-1 lg:grid-cols-2"
          aria-label={t('discover.resultsLabel', { count: tracks.length })}
        >
          {tracks.map((track) => (
            <TrackRow key={track.id} track={track} queue={tracks} />
          ))}
        </ul>
      )}
    </div>
  )
}
