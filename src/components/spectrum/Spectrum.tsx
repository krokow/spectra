import { motion } from 'framer-motion'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { DIMENSIONS, type SpectrumValues } from '@/engine/dimensions'
import { cn } from '@/lib/utils'

type Props = {
  values: SpectrumValues
  /** Second spectre superposé en contour (comparaison avec un ami). */
  compare?: SpectrumValues | undefined
  height?: number
  className?: string
  /** Légende accessible ; par défaut une description générée des dimensions. */
  label?: string
}

const BAR_W = 18
const GAP = 8
const MIN_H = 0.08

/**
 * Le « Spectre » : signature visuelle de chaque utilisateur.
 * Hauteur = valeur, netteté = confiance (une dimension floue est littéralement floue).
 */
export function Spectrum({ values, compare, height = 160, className, label }: Props) {
  const { t } = useTranslation()
  const uid = useId().replace(/:/g, '')
  const width = DIMENSIONS.length * (BAR_W + GAP) - GAP
  const description =
    label ??
    DIMENSIONS.map(
      (d) =>
        `${t(`dimensions.${d}.label`)} ${Math.round(values[d].mean * 100)} % (${t('spectrum.confidence')} ${Math.round(values[d].confidence * 100)} %)`,
    ).join(', ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('w-full', className)}
      role="img"
      aria-label={description}
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        <linearGradient
          id={`g-${uid}`}
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={width}
          y2="0"
        >
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#F472B6" />
        </linearGradient>
        <filter id={`blur-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      {DIMENSIONS.map((d, i) => {
        const v = values[d]
        const h = Math.max(MIN_H, v.mean) * height
        const x = i * (BAR_W + GAP)
        const fuzzy = v.confidence < 0.35
        return (
          <g key={d}>
            <motion.rect
              x={x}
              width={BAR_W}
              rx={BAR_W / 2}
              fill={`url(#g-${uid})`}
              filter={fuzzy ? `url(#blur-${uid})` : undefined}
              initial={false}
              animate={{ y: height - h, height: h, opacity: 0.35 + 0.65 * v.confidence }}
              transition={{ type: 'spring', stiffness: 140, damping: 18, delay: i * 0.025 }}
            />
            {compare && (
              <motion.rect
                x={x - 2}
                width={BAR_W + 4}
                rx={(BAR_W + 4) / 2}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeDasharray="4 4"
                className="text-fg/70"
                initial={false}
                animate={{
                  y: height - Math.max(MIN_H, compare[d].mean) * height,
                  height: Math.max(MIN_H, compare[d].mean) * height,
                }}
                transition={{ type: 'spring', stiffness: 140, damping: 18, delay: i * 0.025 }}
              />
            )}
          </g>
        )
      })}
    </svg>
  )
}
