import { useId } from 'react'
import { cn } from '@/lib/utils'
import { LOGO_BARS } from './logoBars'

type Props = {
  size?: number
  animated?: boolean
  /** Fond nuit arrondi (version icône) ou barres seules. */
  withBackground?: boolean
  className?: string
  /** Chaîne vide = décoratif (masqué aux lecteurs d'écran). */
  title?: string
}

export function LogoMark({
  size = 48,
  animated = false,
  withBackground = true,
  className,
  title = 'Spectra',
}: Props) {
  const uid = useId().replace(/:/g, '')
  const spec = `spec-${uid}`
  const bg = `bg-${uid}`
  const shine = `shine-${uid}`
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
      className={cn(animated && 'logo-animated', className)}
    >
      <defs>
        <radialGradient id={bg} cx="30%" cy="18%" r="95%">
          <stop offset="0" stopColor="#241A5C" />
          <stop offset="0.55" stopColor="#0F0B26" />
          <stop offset="1" stopColor="#07060F" />
        </radialGradient>
        <linearGradient id={spec} gradientUnits="userSpaceOnUse" x1="70" y1="0" x2="442" y2="0">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#F472B6" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {withBackground && <rect width="512" height="512" rx="116" fill={`url(#${bg})`} />}
      {LOGO_BARS.map((b, i) => (
        <g
          key={b.x}
          className="logo-bar"
          style={
            {
              '--breathe-delay': `${(i * 0.13).toFixed(2)}s`,
              '--breathe-to': (0.45 + ((i * 37) % 40) / 100).toFixed(2),
              '--breathe-dur': `${1.3 + (i % 3) * 0.25}s`,
            } as React.CSSProperties
          }
        >
          <rect x={b.x} y={b.y} width="36" height={b.h} rx="18" fill={`url(#${spec})`} />
          <rect x={b.x} y={b.y} width="36" height={b.h} rx="18" fill={`url(#${shine})`} />
        </g>
      ))}
    </svg>
  )
}
