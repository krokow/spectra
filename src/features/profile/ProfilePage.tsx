import { useTranslation } from 'react-i18next'
import { Card } from '@/components/ui/card'
import { LANGUAGES, setLanguage, type Language } from '@/i18n'
import { cn } from '@/lib/utils'

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  return (
    <div className="flex flex-col gap-6 pt-6">
      <h1 className="text-3xl font-bold">{t('profile.title')}</h1>
      <Card>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-3 font-semibold">{t('profile.language')}</legend>
          <div className="flex gap-2">
            {LANGUAGES.map((lang: Language) => (
              <button
                key={lang}
                type="button"
                aria-pressed={i18n.language === lang}
                onClick={() => setLanguage(lang)}
                className={cn(
                  'tap rounded-full border px-5 text-sm font-semibold uppercase',
                  i18n.language === lang
                    ? 'bg-spectrum-soft border-transparent text-night'
                    : 'border-border',
                )}
              >
                {lang}
              </button>
            ))}
          </div>
        </fieldset>
      </Card>
    </div>
  )
}
