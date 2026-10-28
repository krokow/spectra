import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}

/** Boîte de dialogue modale native (<dialog>) : piège du focus, Échap et fond gérés par le navigateur. */
export function Dialog({ open, onClose, title, children, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal?.()
    if (!open && el.open) el.close?.()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onClose={onClose}
      onCancel={onClose}
      className={cn(
        'm-auto w-[min(92vw,28rem)] rounded-lg border border-border bg-bg-elevated p-0 text-fg shadow-(--shadow-soft) backdrop:bg-black/60 backdrop:backdrop-blur-sm',
        className,
      )}
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <h2 id="dialog-title" className="text-xl font-semibold">
            {title}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  )
}
