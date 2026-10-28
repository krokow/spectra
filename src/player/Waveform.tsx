import { useMemo } from 'react'
import type { TrackFeatures } from '@/providers/types'
import { waveform } from './waveform'

type Props = {
  seed: string
  features?: TrackFeatures | undefined
  progress: number
  className?: string
}

/** Waveform décorative ; la barre de lecture accessible est un <input type="range"> à côté. */
export function Waveform({ seed, features, progress, className }: Props) {
  const bars = useMemo(() => waveform(seed, features, 56), [seed, features])
  const w = 4
  const gap = 2
  const width = bars.length * (w + gap) - gap
  return (
    <svg viewBox={`0 0 ${width} 48`} preserveAspectRatio="none" className={className} aria-hidden>
      <defs>
        <linearGradient
          id={`wf-${seed}`}
          x1="0"
          x2={width}
          y1="0"
          y2="0"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#F472B6" />
        </linearGradient>
      </defs>
      {bars.map((h, i) => {
        const played = i / bars.length < progress
        const bh = h * 48
        return (
          <rect
            key={i}
            x={i * (w + gap)}
            y={(48 - bh) / 2}
            width={w}
            height={bh}
            rx={2}
            fill={played ? `url(#wf-${seed})` : 'currentColor'}
            opacity={played ? 1 : 0.25}
          />
        )
      })}
    </svg>
  )
}
