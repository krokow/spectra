import { cn } from '@/lib/utils'

type Props = { value: number; label: string; className?: string }

/** Barre de progression au dégradé de marque. `value` sur [0, 1]. */
export function Progress({ value, label, className }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-strong', className)}
    >
      <div
        className="bg-spectrum h-full rounded-full transition-[width] duration-(--dur-slow) ease-(--ease-out-soft)"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
