import { AnimatePresence, motion } from 'framer-motion'
import { RefreshCw, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '@/components/ui/button'

/** Bandeau « Nouvelle version disponible » avec rechargement en un clic. */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Vérifie une mise à jour toutes les heures si l'app reste ouverte.
      if (registration) setInterval(() => void registration.update(), 60 * 60 * 1000)
    },
  })

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ y: -80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -80, opacity: 0 }}
          className="glass safe-top fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg p-3 pl-4 shadow-(--shadow-soft)"
        >
          <span className="flex-1 text-sm font-medium">{t('pwa.updateAvailable')}</span>
          <Button size="sm" onClick={() => void updateServiceWorker(true)}>
            <RefreshCw aria-hidden />
            {t('pwa.reload')}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t('common.close')}
            onClick={() => setNeedRefresh(false)}
          >
            <X aria-hidden />
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
