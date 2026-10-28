import { Check, Eye, EyeOff, X } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Field } from '@/components/ui/field'
import { PASSWORD_RULES } from '@/schemas/auth'
import { cn } from '@/lib/utils'

type Props = Omit<ComponentProps<'input'>, 'type'> & {
  label: string
  value: string
  error?: string | undefined
  /** Affiche la liste des règles validées en direct (inscription, nouveau mot de passe). */
  showRules?: boolean
}

export function PasswordField({ label, value, error, showRules = false, ...props }: Props) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  return (
    <Field
      {...props}
      label={label}
      value={value}
      error={error}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          className="tap flex items-center justify-center rounded-md text-fg-muted hover:text-fg"
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? (
            <EyeOff className="size-5" aria-hidden />
          ) : (
            <Eye className="size-5" aria-hidden />
          )}
        </button>
      }
      hint={
        showRules ? (
          <ul
            className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1"
            aria-label={t('auth.passwordRules.title')}
          >
            {PASSWORD_RULES.map((r) => {
              const ok = r.test(value)
              return (
                <li
                  key={r.id}
                  className={cn('flex items-center gap-1.5', ok ? 'text-success' : 'text-fg-muted')}
                >
                  {ok ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <X className="size-4" aria-hidden />
                  )}
                  <span>
                    {t(`auth.passwordRules.${r.id}`)}
                    <span className="sr-only">
                      {ok ? ` (${t('auth.ok')})` : ` (${t('auth.missing')})`}
                    </span>
                  </span>
                </li>
              )
            })}
          </ul>
        ) : undefined
      }
    />
  )
}
