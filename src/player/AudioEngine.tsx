import { useEffect, useRef } from 'react'
import { MusicError, musicProvider } from '@/providers'
import { usePlayer } from './store'

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

/**
 * Moteur du lecteur global : un seul <audio> pour toute l'app.
 * - rafraîchit l'URL d'extrait si elle a expiré (et réessaie une fois en cas d'erreur) ;
 * - relaie l'état vers le store ; Media Session (écran verrouillé) ; raccourcis clavier.
 * Les extraits ne sont jamais mis en cache (cf. service worker).
 */
export function AudioEngine() {
  const audio = useRef<HTMLAudioElement>(null)
  const retried = useRef<string | null>(null)
  const index = usePlayer((s) => s.index)
  const queue = usePlayer((s) => s.queue)
  const status = usePlayer((s) => s.status)
  const seekTo = usePlayer((s) => s.seekTo)
  const track = queue[index] ?? null

  // Nouveau morceau (ou relance après pause/erreur) : prépare la source puis joue.
  useEffect(() => {
    const el = audio.current
    if (!el || !track) return
    if (status === 'paused') {
      el.pause()
      return
    }
    if (status !== 'loading') return
    let cancelled = false
    const { _report, _replace } = usePlayer.getState()
    void (async () => {
      try {
        const fresh = await musicProvider.ensurePreview(track)
        if (cancelled) return
        if (fresh !== track) _replace(fresh)
        if (!fresh.preview_url) throw new MusicError('no_preview')
        if (el.src !== fresh.preview_url) el.src = fresh.preview_url
        await el.play()
      } catch (e) {
        if (cancelled) return
        // Lecture bloquée par le navigateur (pas de geste utilisateur) : simple pause.
        if (e instanceof DOMException && e.name === 'NotAllowedError') _report({ status: 'paused' })
        else _report({ status: 'error', errorKey: e instanceof MusicError ? e.key : 'playback' })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [track, status])

  useEffect(() => {
    const el = audio.current
    if (!el || seekTo === null) return
    el.currentTime = seekTo
    usePlayer.getState()._report({ seekTo: null })
  }, [seekTo])

  // Media Session : contrôles sur l'écran verrouillé / casque.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !track) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist_name,
      album: track.album ?? '',
      artwork: track.cover_url ? [{ src: track.cover_url, sizes: '600x600' }] : [],
    })
    const p = usePlayer.getState
    navigator.mediaSession.setActionHandler('play', () => p().toggle())
    navigator.mediaSession.setActionHandler('pause', () => p().toggle())
    navigator.mediaSession.setActionHandler('nexttrack', () => p().next())
    navigator.mediaSession.setActionHandler('previoustrack', () => p().previous())
  }, [track])

  // Raccourcis clavier (désactivés pendant la saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = usePlayer.getState()
      if (!p.current() || isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const actions: Record<string, () => void> = {
        ' ': p.toggle,
        k: p.toggle,
        ArrowRight: () => p.seek(p.position + 5),
        l: () => p.seek(p.position + 5),
        ArrowLeft: () => p.seek(p.position - 5),
        j: () => p.seek(p.position - 5),
        n: p.next,
        b: p.previous,
        Escape: () => p.setExpanded(false),
      }
      const action = actions[e.key]
      // Espace sur un bouton : laisser le bouton gérer son propre clic.
      if (!action || (e.key === ' ' && (e.target as HTMLElement | null)?.tagName === 'BUTTON'))
        return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const report = usePlayer.getState()._report
  return (
    <audio
      ref={audio}
      preload="none"
      onPlaying={() => report({ status: 'playing' })}
      onPause={() => {
        if (usePlayer.getState().status === 'playing') report({ status: 'paused' })
      }}
      onTimeUpdate={(e) => report({ position: e.currentTarget.currentTime })}
      onLoadedMetadata={(e) =>
        report({
          duration: Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 30,
        })
      }
      onEnded={() => usePlayer.getState().next()}
      onError={() => {
        const current = usePlayer.getState().current()
        if (!current) return
        // URL expirée entre-temps : on force un rafraîchissement, une seule fois par morceau.
        if (retried.current !== current.id) {
          retried.current = current.id
          usePlayer.getState()._replace({ ...current, preview_expires_at: null })
          report({ status: 'loading' })
        } else {
          report({ status: 'error', errorKey: 'playback' })
        }
      }}
    />
  )
}
