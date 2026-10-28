import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { loginSchema } from '@/schemas/auth'
import { signIn } from './api'
import { authErrorKey } from './errors'
import { PasswordField } from './PasswordField'

export function LoginForm() {
  const { t } = useTranslation()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    // La redirection (vers la page demandée au départ) est faite par la garde GuestOnly.
    mutationFn: () => signIn(identifier, password),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = loginSchema.safeParse({ identifier, password })
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), t(`auth.errors.${i.message}`)]),
        ),
      )
      return
    }
    setErrors({})
    mutation.mutate()
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
      aria-label={t('auth.login')}
    >
      <Field
        label={t('auth.identifier')}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        error={errors.identifier}
        required
      />
      <PasswordField
        label={t('auth.password')}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        required
      />
      {mutation.isError && (
        <p role="alert" className="text-sm text-danger">
          {t(`auth.errors.${authErrorKey(mutation.error)}`)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
        {t('auth.login')}
      </Button>
      <Link
        to="/recover"
        className="self-center rounded-md px-2 py-2 text-sm text-fg-muted underline-offset-4 hover:text-fg hover:underline"
      >
        {t('auth.forgot')}
      </Link>
    </form>
  )
}
