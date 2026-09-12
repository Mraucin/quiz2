import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all select-none outline-none focus-visible:ring-2 focus-visible:ring-gold/70 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px',
  {
    variants: {
      variant: {
        primary:
          'bg-gold text-stage-900 hover:bg-gold/90 shadow-[0_10px_24px_-12px_oklch(0.83_0.16_85/0.9)]',
        secondary: 'bg-stage-700/80 text-white hover:bg-stage-600/80 border border-stage-600',
        ghost: 'bg-transparent text-white/80 hover:bg-white/10',
        outline: 'border border-stage-600 bg-transparent text-white hover:bg-white/10',
        success: 'bg-mint text-stage-900 hover:bg-mint/90',
        danger: 'bg-coral text-white hover:bg-coral/90',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        xl: 'h-16 px-8 text-lg',
        icon: 'size-9',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size }), className)} {...props} />
}

export { buttonVariants }
