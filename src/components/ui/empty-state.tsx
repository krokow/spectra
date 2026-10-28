import type { ReactNode } from 'react'
import { LogoMark } from '@/components/brand/LogoMark'

type Props = { title: string; description: string; action?: ReactNode }

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <LogoMark size={64} withBackground={false} title="" className="opacity-60" />
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="max-w-sm text-fg-muted">{description}</p>
      {action}
    </div>
  )
}
