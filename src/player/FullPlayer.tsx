import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronDown,
  ExternalLink,
  Loader2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
} from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { sourceLink } from '@/providers/types'
import { Cover } from './Cover'
import { usePlayer } from './store'
import { Waveform } from './Waveform'

const fmt = (s: number) => `0:${String(Math.floor(Math.max(0, s))).padStart(2, '0')}`

/** Lecteur plein écran : grosse pochette, waveform, contrôles, attribution de la source. */
export function FullPlayer() {
  const { t } = useTranslation()
  const p = usePlayer()
  const track = p.current()
  const closeRef = useRef<HTMLButtonElement>(null)
  const open = !!track && p.expanded

  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  const source = track ? sourceLink(track) : null
  const progress = p.duration ? p.position / p.duration : 0

  return (
    <AnimatePresence>
      {open && track && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={t('player.label')}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg"
        >
          <div className="ambient-glow" aria-hidden />
          <div className="safe-top mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-6 pt-4 pb-10 lg:max-w-lg lg:justify-center">
            <Button
              ref={closeRef}
              variant="ghost"
              size="icon"
              className="self-start"
              onClick={() => p.setExpanded(false)}
              aria-label={t('player.collapse')}
            >
              <ChevronDown aria-hidden />
            </Button>
            <Cover
              src={track.cover_url}
              alt={t('player.coverOf', { title: track.title })}
              className="aspect-square w-full rounded-xl shadow-(--shadow-glow)"
            />
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold">{track.title}</h2>
              <p className="truncate text-lg text-fg-muted">{track.artist_name}</p>
            </div>

            <div className="flex flex-col gap-2">
              <Waveform seed={track.id} progress={progress} className="h-12 w-full text-fg" />
              <input
                type="range"
                min={0}
                max={p.duration || 30}
                step={0.5}
                value={p.position}
                onChange={(e) => p.seek(Number(e.target.value))}
                aria-label={t('player.seek')}
                aria-valuetext={`${fmt(p.position)} / ${fmt(p.duration)}`}
                className="w-full accent-violet"
              />
              <div className="tabular flex justify-between text-xs text-fg-muted">
                <span>{fmt(p.position)}</span>
                <span>{fmt(p.duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6">
              <Button
                size="icon"
                variant="ghost"
                onClick={p.previous}
                aria-label={t('player.previous')}
              >
                <SkipBack aria-hidden />
              </Button>
              <Button
                size="lg"
                className="size-18 rounded-full p-0"
                onClick={p.toggle}
                aria-label={p.status === 'playing' ? t('player.pause') : t('player.play')}
              >
                {p.status === 'loading' ? (
                  <Loader2 className="size-8! animate-spin" aria-hidden />
                ) : p.status === 'playing' ? (
                  <Pause className="size-8!" aria-hidden />
                ) : (
                  <Play className="size-8!" aria-hidden />
                )}
              </Button>
              <Button size="icon" variant="ghost" onClick={p.next} aria-label={t('player.next')}>
                <SkipForward aria-hidden />
              </Button>
            </div>

            {p.status === 'error' && (
              <p role="alert" className="text-center text-sm text-danger">
                {t(`player.errors.${p.errorKey ?? 'playback'}`)}
              </p>
            )}

            <p className="text-center text-xs text-fg-muted">
              {t('player.previewNote')}{' '}
              {source && (
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-fg underline underline-offset-4"
                >
                  {t('player.listenOn', { source: source.label })}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </p>
            <p className="hidden text-center text-xs text-fg-muted lg:block">
              {t('player.shortcuts')}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
