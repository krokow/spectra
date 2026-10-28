import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Expose l'invite d'installation PWA (Chrome/Edge/Android). Sur iOS : instructions manuelles. */
export function useInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(
    () => typeof window !== 'undefined' && matchMedia('(display-mode: standalone)').matches,
  )

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setEvent(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  return {
    canInstall: !!event && !installed,
    installed,
    install: async () => {
      if (!event) return
      await event.prompt()
      await event.userChoice
      setEvent(null)
    },
  }
}
