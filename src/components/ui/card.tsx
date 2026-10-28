import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('glass rounded-lg p-5 shadow-(--shadow-soft)', className)} {...props} />
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-semibold', className)} {...props} />
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-fg-muted', className)} {...props} />
}
