import { Gavel, HelpCircle, ListChecks, Volume2 } from 'lucide-react'
import type { BoardCell, GameState, QuestionKind } from '@/lib/types'
import { cn, formatPoints } from '@/lib/utils'

const kindIcon: Record<QuestionKind, typeof HelpCircle> = {
  standard: HelpCircle,
  wheel: Volume2,
  list: ListChecks,
  auction: Gavel,
}

const kindLabel: Record<QuestionKind, string> = {
  standard: 'Pytanie',
  wheel: 'Koło fortuny',
  list: 'Wyliczanka',
  auction: 'Licytacja',
}

export function BoardGrid({
  state,
  onPick,
  disabled,
  compact,
}: {
  state: GameState
  onPick?: (categoryId: string, cell: BoardCell) => void
  disabled?: boolean
  compact?: boolean
}) {
  const visible = state.board.filter((category) => category.round === state.round)
  return (
    <div className="w-full overflow-x-auto pb-2">
      <div
        className="grid min-w-[52rem] gap-2"
        style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}
      >
        {visible.map((category) => (
          <div key={category.id} className="flex flex-col gap-2">
            <div className="panel flex min-h-[3.75rem] flex-col justify-center px-2 py-2 text-center">
              <div className="text-display text-[0.78rem] leading-tight text-gold">
                {category.name}
              </div>
              {category.fixedValue == null && category.multiplier !== 1 ? (
                <div
                  className={cn(
                    'text-[0.6rem] font-semibold tracking-widest',
                    category.multiplier > 1 ? 'text-mint' : 'text-coral',
                  )}
                >
                  ×{category.multiplier} PUNKTY
                </div>
              ) : null}
            </div>
            {category.cells.map((cell) => {
              const Icon = kindIcon[cell.kind]
              return (
                <button
                  key={cell.questionId}
                  type="button"
                  disabled={disabled || cell.used || !onPick}
                  title={kindLabel[cell.kind]}
                  onClick={() => onPick?.(category.id, cell)}
                  className={cn(
                    'group relative grid place-items-center rounded-xl border transition-all tile-shadow',
                    compact ? 'h-12' : 'h-[4.4rem]',
                    cell.used
                      ? 'border-stage-700/60 bg-stage-900/40 text-white/15'
                      : 'border-stage-600 bg-tile text-gold hover:bg-tile-hot hover:text-white',
                    !cell.used && !disabled && onPick
                      ? 'cursor-pointer hover:-translate-y-0.5'
                      : 'cursor-default',
                  )}
                >
                  <span className={cn('text-display', compact ? 'text-base' : 'text-2xl')}>
                    {cell.used ? '—' : formatPoints(cell.value)}
                  </span>
                  {!cell.used ? (
                    <Icon className="absolute top-1 right-1 size-3 opacity-45 group-hover:opacity-90" />
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
