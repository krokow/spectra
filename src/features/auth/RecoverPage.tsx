import { useMutation } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { recoverSchema } from '@/schemas/auth'
import { recoverAccount } from './api'
import { authErrorKey } from './errors'
import { PasswordField } from './PasswordField'

export default function RecoverPage() {
  const { t } = useTranslation()
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const mutation = useMutation({ mutationFn: recoverAccount })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = recoverSchema.safeParse({ identifier, code, newPassword })
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), t(`auth.errors.${i.message}`)]),
        ),
      )
      return
    }
    setErrors({})
    mutation.mutate(parsed.data)
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div className="ambient-glow" aria-hidden />
      <Link
        to="/welcome"
        className="inline-flex items-center gap-2 self-start rounded-md py-2 text-sm text-fg-muted hover:text-fg"
      >
        <ArrowLeft className="size-4" aria-hidden /> {t('common.back')}
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('auth.recover.title')}</h1>
        <p className="text-fg-muted">{t('auth.recover.explain')}</p>
      </div>
      <Card>
        {mutation.isSuccess ? (
          <div className="flex flex-col gap-4 text-center" role="status">
            <p className="text-lg font-semibold">{t('auth.recover.done')}</p>
            <p className="text-sm text-fg-muted">{t('auth.recover.doneHint')}</p>
            <Button asChild size="lg">
              <Link to="/welcome">{t('auth.login')}</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <Field
              label={t('auth.identifier')}
              autoComplete="username"
              autoCapitalize="none"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              error={errors.identifier}
            />
            <Field
              label={t('auth.recover.code')}
              placeholder="ABCD-EFGH"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono tracking-wider uppercase"
              maxLength={9}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              error={errors.code}
            />
            <PasswordField
              label={t('auth.recover.newPassword')}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              error={errors.newPassword}
              showRules
            />
            {mutation.isError && (
              <p role="alert" className="text-sm text-danger">
                {t(`auth.errors.${authErrorKey(mutation.error)}`)}
              </p>
            )}
            <Button type="submit" size="lg" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
              {t('auth.recover.submit')}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
