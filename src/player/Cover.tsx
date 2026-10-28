import { Music } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Cover({
  src,
  alt,
  className,
}: {
  src?: string | null | undefined
  alt: string
  className?: string
}) {
  if (!src) {
    return (
      <span
        className={cn('bg-spectrum-soft flex items-center justify-center text-night', className)}
        aria-hidden
      >
        <Music className="size-1/3" />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={cn('object-cover', className)}
    />
  )
}
