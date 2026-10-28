import { useMutation, useQuery } from '@tanstack/react-query'
import { Check, Loader2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { haptic } from '@/lib/haptics'
import { useDebounced } from '@/lib/useDebounced'
import { USERNAME_RE, signupSchema } from '@/schemas/auth'
import { isUsernameAvailable, signUp } from './api'
import { authErrorKey } from './errors'
import { PasswordField } from './PasswordField'

export function SignupForm() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const debounced = useDebounced(username.trim())
  const formatOk = USERNAME_RE.test(debounced)
  const availability = useQuery({
    queryKey: ['username-available', debounced.toLowerCase()],
    queryFn: () => isUsernameAvailable(debounced),
    enabled: formatOk,
    staleTime: 30_000,
    retry: false,
  })

  const mutation = useMutation({
    mutationFn: signUp,
    // La garde GuestOnly emmène ensuite vers les codes de secours.
    onSuccess: () => haptic([10, 40, 10]),
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = signupSchema.safeParse({ email, username, password })
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((i) => [String(i.path[0]), t(`auth.errors.${i.message}`)]),
        ),
      )
      return
    }
    if (availability.data === false) {
      setErrors({ username: t('auth.errors.username_taken') })
      return
    }
    setErrors({})
    mutation.mutate(parsed.data)
  }

  let usernameHint: React.ReactNode = t('auth.usernameHint')
  if (username && debounced === username.trim()) {
    if (!formatOk) usernameHint = t('auth.usernameHint')
    else if (availability.isFetching)
      usernameHint = (
        <span className="inline-flex items-center gap-1.5">
          <Loader2 className="size-4 animate-spin" aria-hidden /> {t('auth.checking')}
        </span>
      )
    else if (availability.data === true)
      usernameHint = (
        <span className="inline-flex items-center gap-1.5 text-success">
          <Check className="size-4" aria-hidden /> {t('auth.usernameFree')}
        </span>
      )
    else if (availability.data === false)
      usernameHint = (
        <span className="inline-flex items-center gap-1.5 text-danger">
          <X className="size-4" aria-hidden /> {t('auth.errors.username_taken')}
        </span>
      )
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-4"
      aria-label={t('auth.signup')}
    >
      <Field
        label={t('auth.email')}
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={errors.email}
        required
      />
      <Field
        label={t('auth.username')}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={errors.username}
        hint={<span aria-live="polite">{usernameHint}</span>}
        required
      />
      <PasswordField
        label={t('auth.password')}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={errors.password}
        showRules
        required
      />
      {mutation.isError && (
        <p role="alert" className="text-sm text-danger">
          {t(`auth.errors.${authErrorKey(mutation.error)}`)}
        </p>
      )}
      <Button type="submit" size="lg" disabled={mutation.isPending}>
        {mutation.isPending && <Loader2 className="animate-spin" aria-hidden />}
        {t('auth.createAccount')}
      </Button>
      <p className="text-center text-xs text-fg-muted">{t('auth.privacyNote')}</p>
    </form>
  )
}
