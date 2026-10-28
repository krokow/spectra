import { motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LogoMark } from '@/components/brand/LogoMark'
import { Spectrum } from '@/components/spectrum/Spectrum'
import { Card } from '@/components/ui/card'
import { demoSpectrum } from '@/features/home/demoSpectrum'
import { cn } from '@/lib/utils'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'

type Tab = 'signup' | 'login'

export default function WelcomePage() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<Tab>('signup')

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 px-4 py-10">
      <div className="ambient-glow" aria-hidden />
      <motion.header
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <LogoMark size={88} animated />
        <h1 className="text-4xl font-bold">
          <span className="text-spectrum">{t('home.title')}</span>
        </h1>
        <p className="text-fg-muted">{t('home.subtitle')}</p>
        <Spectrum
          values={demoSpectrum}
          height={70}
          label={t('home.preview')}
          className="max-w-60 opacity-80"
        />
      </motion.header>

      <Card className="p-6">
        <div
          role="tablist"
          aria-label={t('auth.chooseAction')}
          className="mb-6 grid grid-cols-2 rounded-full bg-surface p-1"
        >
          {(['signup', 'login'] as const).map((id) => (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              type="button"
              aria-selected={tab === id}
              aria-controls={`panel-${id}`}
              onClick={() => setTab(id)}
              className={cn(
                'tap rounded-full text-sm font-semibold transition-colors',
                tab === id ? 'bg-spectrum-soft text-night' : 'text-fg-muted hover:text-fg',
              )}
            >
              {t(id === 'signup' ? 'auth.signup' : 'auth.login')}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'signup' ? <SignupForm /> : <LoginForm />}
        </div>
      </Card>
    </div>
  )
}
