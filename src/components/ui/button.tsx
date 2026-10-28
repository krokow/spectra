import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'tap inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[transform,background,box-shadow,opacity] duration-(--dur-base) ease-(--ease-spring) select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // Dégradé « spectre » doux + texte nuit : contraste AA sur toute la largeur.
        primary: 'bg-spectrum-soft text-night shadow-(--shadow-glow) hover:brightness-110',
        glass: 'glass text-fg hover:bg-surface-strong',
        ghost: 'text-fg hover:bg-surface',
        outline: 'border border-border text-fg hover:bg-surface',
        danger: 'bg-danger text-white hover:brightness-110',
      },
      size: {
        sm: 'h-10 px-4 text-sm',
        md: 'h-12 px-6 text-base',
        lg: 'h-14 px-8 text-lg',
        icon: 'size-11',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
