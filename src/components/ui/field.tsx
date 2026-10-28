import { useId, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = ComponentProps<'input'> & {
  label: string
  hint?: ReactNode
  error?: string | undefined
  trailing?: ReactNode
}

/** Champ texte accessible : label associé, aide et erreur reliées par aria-describedby. */
export function Field({ label, hint, error, trailing, className, id, ...props }: Props) {
  const auto = useId()
  const inputId = id ?? auto
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-12 w-full rounded-md border border-border bg-surface px-4 text-base transition-colors',
            'placeholder:text-fg-muted/70 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
            error && 'border-danger',
            trailing && 'pr-12',
            className,
          )}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {hint && (
        <div id={hintId} className="text-sm text-fg-muted">
          {hint}
        </div>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
