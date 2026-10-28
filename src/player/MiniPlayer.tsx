import { AnimatePresence, motion } from 'framer-motion'
import { ChevronUp, Loader2, Pause, Play, SkipForward, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Cover } from './Cover'
import { usePlayer } from './store'

/** Mini-lecteur persistant : au-dessus de la barre du bas (mobile), en bas du contenu (ordinateur). */
export function MiniPlayer() {
  const { t } = useTranslation()
  const p = usePlayer()
  const track = p.current()
  const progress = p.duration ? p.position / p.duration : 0

  return (
    <AnimatePresence>
      {track && !p.expanded && (
        <motion.section
          aria-label={t('player.label')}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className="glass fixed inset-x-2 bottom-[calc(var(--nav-height)+env(safe-area-inset-bottom)+0.5rem)] z-30 mx-auto max-w-2xl overflow-hidden rounded-lg shadow-(--shadow-soft) lg:inset-x-auto lg:right-6 lg:bottom-6 lg:left-[calc(16rem+1.5rem)] lg:max-w-none"
        >
          <div className="flex items-center gap-3 p-2 pr-3">
            <button
              type="button"
              onClick={() => p.setExpanded(true)}
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
              aria-label={t('player.expand')}
            >
              <Cover src={track.cover_url} alt="" className="size-12 shrink-0 rounded-md" />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{track.title}</span>
                <span className="block truncate text-sm text-fg-muted">
                  {p.status === 'error'
                    ? t(`player.errors.${p.errorKey ?? 'playback'}`)
                    : track.artist_name}
                </span>
              </span>
              <ChevronUp className="size-5 shrink-0 text-fg-muted" aria-hidden />
            </button>
            <Button
              size="icon"
              variant="ghost"
              onClick={p.toggle}
              aria-label={p.status === 'playing' ? t('player.pause') : t('player.play')}
            >
              {p.status === 'loading' ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : p.status === 'playing' ? (
                <Pause aria-hidden />
              ) : (
                <Play aria-hidden />
              )}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={p.next}
              aria-label={t('player.next')}
              className="hidden sm:inline-flex"
            >
              <SkipForward aria-hidden />
            </Button>
            <Button size="icon" variant="ghost" onClick={p.close} aria-label={t('player.close')}>
              <X aria-hidden />
            </Button>
          </div>
          <div className="h-1 bg-surface-strong" aria-hidden>
            <div
              className="bg-spectrum h-full transition-[width] duration-200 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
