import { cn } from '@/lib/utils'
import { LogoMark } from './LogoMark'

/** Déclinaison wordmark : icône + « spectra » en Sora, dégradé de marque. */
export function Wordmark({
  className,
  animated = false,
}: {
  className?: string
  animated?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={28} animated={animated} title="" />
      <span className="text-spectrum font-display text-xl font-bold tracking-[-0.04em]">
        spectra
      </span>
    </span>
  )
}
