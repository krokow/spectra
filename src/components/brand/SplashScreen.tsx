import { useTranslation } from 'react-i18next'
import { LogoMark } from './LogoMark'

export function SplashScreen() {
  const { t } = useTranslation()
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-6"
      role="status"
      aria-live="polite"
    >
      <LogoMark size={96} animated />
      <p className="text-sm text-fg-muted">{t('common.loading')}</p>
    </div>
  )
}
