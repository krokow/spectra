import { useMutation } from '@tanstack/react-query'
import { Copy, Download, KeyRound, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { generateRecoveryCodes } from '@/features/profile/api'
import { authErrorKey } from './errors'
import { setPostAuthTarget } from './postAuth'

/**
 * Affiche les 8 codes de secours UNE SEULE FOIS (ils sont stockés hachés).
 * Atteinte après l'inscription, ou depuis le profil pour régénérer.
 */
export default function RecoveryCodesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const firstTime = (useLocation().state as { firstTime?: boolean } | null)?.firstTime ?? false
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const gen = useMutation({ mutationFn: generateRecoveryCodes })

  useEffect(() => setPostAuthTarget(null), [])

  // Génération automatique à l'arrivée (une seule fois, même en StrictMode).
  const { mutate, isIdle } = gen
  useEffect(() => {
    if (isIdle) mutate()
  }, [isIdle, mutate])

  const codes = gen.data ?? []
  const text = `Spectra : codes de secours\n${new Date().toLocaleDateString()}\n\n${codes.join('\n')}\n\n${t('auth.codes.fileNote')}\n`

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), {
      href: url,
      download: 'spectra-codes-de-secours.txt',
    })
    a.click()
    URL.revokeObjectURL(url)
    setSaved(true)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="ambient-glow" aria-hidden />
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="bg-spectrum-soft flex size-14 items-center justify-center rounded-full text-night">
          <KeyRound className="size-7" aria-hidden />
        </span>
        <h1 className="text-3xl font-bold">
          {firstTime ? t('auth.codes.welcomeTitle') : t('auth.codes.title')}
        </h1>
        <p className="text-fg-muted">{t('auth.codes.explain')}</p>
      </div>

      <Card className="flex flex-col gap-4">
        {gen.isPending && (
          <div className="flex justify-center py-8" role="status">
            <Loader2 className="size-6 animate-spin" aria-label={t('common.loading')} />
          </div>
        )}
        {gen.isError && (
          <div className="flex flex-col items-center gap-3">
            <p role="alert" className="text-sm text-danger">
              {t(`auth.errors.${authErrorKey(gen.error)}`)}
            </p>
            <Button variant="glass" onClick={() => gen.mutate()}>
              {t('common.retry')}
            </Button>
          </div>
        )}
        {codes.length > 0 && (
          <>
            <ol
              className="tabular grid grid-cols-2 gap-2 font-mono text-lg"
              aria-label={t('auth.codes.listLabel')}
            >
              {codes.map((c) => (
                <li key={c} className="rounded-md bg-surface py-2 text-center tracking-wider">
                  {c}
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="glass" onClick={download}>
                <Download aria-hidden />
                {t('auth.codes.download')}
              </Button>
              <Button
                variant="glass"
                onClick={() =>
                  void navigator.clipboard.writeText(codes.join('\n')).then(() => {
                    setCopied(true)
                    setSaved(true)
                  })
                }
              >
                <Copy aria-hidden />
                {copied ? t('auth.codes.copied') : t('auth.codes.copy')}
              </Button>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-5 accent-violet"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
              />
              {t('auth.codes.confirm')}
            </label>
            <Button
              size="lg"
              disabled={!saved}
              onClick={() => navigate(firstTime ? '/' : '/profile', { replace: true })}
            >
              {firstTime ? t('auth.codes.start') : t('common.continue')}
            </Button>
          </>
        )}
      </Card>
    </div>
  )
}
