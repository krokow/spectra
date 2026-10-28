import { cn } from '@/lib/utils'
import { avatarHue } from './avatarHue'

type Props = { seed: string; name: string; size?: number; className?: string }

/** Avatar généré (aucune image stockée) : dégradé propre à chacun + initiales. */
export function Avatar({ seed, name, size = 48, className }: Props) {
  const hue = avatarHue(seed)
  const initials =
    name
      .replace(/[_\d]+/g, ' ')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || name.slice(0, 2).toUpperCase()
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold text-night',
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, hsl(${hue} 85% 72%), hsl(${(hue + 70) % 360} 85% 68%))`,
      }}
    >
      {initials}
    </span>
  )
}
