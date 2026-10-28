import { motion } from 'framer-motion'
import { Download, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useInstallPrompt } from '@/app/pwa/useInstallPrompt'
import { Spectrum } from '@/components/spectrum/Spectrum'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { demoSpectrum } from './demoSpectrum'

export default function HomePage() {
  const { t } = useTranslation()
  const { canInstall, install } = useInstallPrompt()

  return (
    <div className="flex flex-col gap-8 pt-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className="flex flex-col gap-4"
      >
        <h1 className="text-4xl leading-[1.05] font-bold sm:text-5xl">
          <span className="text-spectrum">{t('home.title')}</span>
        </h1>
        <p className="text-lg text-fg-muted">{t('home.subtitle')}</p>
        <Button size="lg" asChild className="self-start">
          <Link to="/spectrum">
            <Sparkles aria-hidden />
            {t('home.cta')}
          </Link>
        </Button>
      </motion.section>

      <Card className="p-6">
        <Spectrum values={demoSpectrum} height={180} label={t('home.preview')} />
      </Card>

      {canInstall && (
        <Card className="flex items-center gap-4">
          <div className="flex-1">
            <p className="font-semibold">{t('pwa.install')}</p>
            <p className="text-sm text-fg-muted">{t('pwa.installHint')}</p>
          </div>
          <Button variant="glass" onClick={() => void install()}>
            <Download aria-hidden />
            {t('pwa.install')}
          </Button>
        </Card>
      )}
    </div>
  )
}
