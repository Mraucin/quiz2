import type { ComponentProps, ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export function Panel({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('panel p-4', className)} {...props} />
}

export function PanelTitle({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('text-display text-sm tracking-[0.18em] text-gold/90', className)}
      {...props}
    />
  )
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-10 w-full rounded-xl border border-stage-600 bg-stage-900/60 px-3 text-white placeholder:text-white/35 outline-none transition focus:border-gold/70 focus:ring-2 focus:ring-gold/25',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-stage-600 bg-stage-900/60 p-3 text-white placeholder:text-white/35 outline-none transition focus:border-gold/70 focus:ring-2 focus:ring-gold/25',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-10 w-full rounded-xl border border-stage-600 bg-stage-900/80 px-3 text-white outline-none transition focus:border-gold/70',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('mb-1 block text-xs font-medium tracking-wide text-white/55', className)}
      {...props}
    />
  )
}

export function Badge({
  className,
  tone = 'neutral',
  ...props
}: ComponentProps<'span'> & { tone?: 'neutral' | 'gold' | 'mint' | 'coral' | 'violet' }) {
  const tones = {
    neutral: 'bg-white/10 text-white/75',
    gold: 'bg-gold/20 text-gold',
    mint: 'bg-mint/20 text-mint',
    coral: 'bg-coral/25 text-coral',
    violet: 'bg-violet-glow/20 text-violet-glow',
  } as const
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div
        className={cn(
          'panel animate-pop my-8 w-full p-5',
          wide ? 'max-w-4xl' : 'max-w-xl',
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <PanelTitle className="text-base">{title}</PanelTitle>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Zamknij">
            <X className="size-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-stage-600/80 p-10 text-center">
      {icon ? <div className="text-gold/70">{icon}</div> : null}
      <div className="text-display text-lg">{title}</div>
      {hint ? <p className="max-w-md text-sm text-white/55">{hint}</p> : null}
      {action}
    </div>
  )
}
