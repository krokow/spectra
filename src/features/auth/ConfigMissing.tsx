import { useTranslation } from 'react-i18next'
import { LogoMark } from '@/components/brand/LogoMark'

export function ConfigMissing() {
  const { t } = useTranslation()
  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <LogoMark size={72} />
      <h1 className="text-2xl font-bold">{t('auth.configMissing.title')}</h1>
      <p className="max-w-sm text-fg-muted">{t('auth.configMissing.text')}</p>
    </div>
  )
}
