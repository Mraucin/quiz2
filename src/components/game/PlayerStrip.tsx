import { Crown, WifiOff } from 'lucide-react'
import type { GameState, Player } from '@/lib/types'
import { cn, formatPoints } from '@/lib/utils'

function leaderId(state: GameState) {
  const best = [...state.players].sort((a, b) => b.score - a.score)[0]
  return best && best.score > 0 ? best.id : null
}

export function PlayerStrip({
  state,
  highlightId,
  meId,
  onSelect,
  compact,
}: {
  state: GameState
  highlightId?: string | null
  meId?: string | null
  onSelect?: (player: Player) => void
  compact?: boolean
}) {
  const leader = leaderId(state)
  if (state.players.length === 0) {
    return (
      <div className="panel px-4 py-3 text-center text-sm text-white/50">
        Nikt jeszcze nie dołączył — rozdaj kod pokoju.
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {state.players.map((player) => {
        const isTurn = highlightId === player.id
        const isMe = meId === player.id
        return (
          <button
            key={player.id}
            type="button"
            onClick={onSelect ? () => onSelect(player) : undefined}
            className={cn(
              'panel relative flex min-w-[8.5rem] flex-1 items-center gap-3 px-3 py-2 text-left transition',
              onSelect ? 'hover:border-gold/60 cursor-pointer' : 'cursor-default',
              isTurn && 'border-gold/80 shadow-[0_0_0_2px_oklch(0.83_0.16_85/0.35)]',
              !player.connected && 'opacity-60',
              compact && 'min-w-[7rem] py-1.5',
            )}
          >
            <span
              className={cn(
                'grid size-10 shrink-0 place-items-center rounded-full text-xl',
                compact && 'size-8 text-base',
              )}
              style={{
                background: `color-mix(in oklch, ${player.color} 28%, transparent)`,
                boxShadow: `inset 0 0 0 2px ${player.color}`,
              }}
            >
              {player.avatar}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 truncate text-sm font-semibold">
                {player.name}
                {isMe ? <span className="text-[10px] text-gold">(Ty)</span> : null}
                {leader === player.id ? <Crown className="size-3.5 text-gold" /> : null}
              </span>
              <span
                className={cn(
                  'text-display text-lg leading-tight',
                  player.score < 0 ? 'text-coral' : 'text-white',
                )}
              >
                {formatPoints(player.score)}
              </span>
            </span>
            <span className="absolute top-1 right-1 flex gap-1">
              {!player.connected ? (
                <span title="Rozłączony">
                  <WifiOff className="size-3.5 text-white/40" />
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}
