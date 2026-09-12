import { Medal, Trophy } from 'lucide-react'
import { standings } from '@/lib/engine'
import type { GameState } from '@/lib/types'
import { cn, formatPoints } from '@/lib/utils'

const podiumTone = ['border-gold bg-gold/15', 'border-white/40 bg-white/10', 'border-coral/60 bg-coral/10']

export function Results({ state, meId }: { state: GameState; meId?: string | null }) {
  const ranked = standings(state)
  const winner = ranked[0]
  const podium = ranked.slice(0, 3)

  return (
    <div className="flex flex-col items-center gap-8 py-6">
      <div className="text-center">
        <div className="text-xs tracking-[0.35em] text-white/50 uppercase">Koniec gry</div>
        <div className="text-display animate-pop text-5xl text-gold sm:text-7xl">
          {winner ? `${winner.avatar} ${winner.name}` : 'Brak graczy'}
        </div>
        {winner ? (
          <div className="mt-1 text-2xl font-semibold">{formatPoints(winner.score)} punktów</div>
        ) : null}
      </div>

      <div className="flex w-full max-w-3xl items-end justify-center gap-3">
        {podium.map((player, index) => (
          <div
            key={player.id}
            className={cn(
              'flex flex-1 flex-col items-center gap-2 rounded-card border p-4 text-center',
              podiumTone[index],
              index === 0 ? 'order-2 pb-10' : index === 1 ? 'order-1 pb-6' : 'order-3 pb-4',
            )}
          >
            {index === 0 ? (
              <Trophy className="size-7 text-gold" />
            ) : (
              <Medal className={cn('size-6', index === 1 ? 'text-white/70' : 'text-coral')} />
            )}
            <span className="text-3xl">{player.avatar}</span>
            <span className="truncate text-sm font-semibold">{player.name}</span>
            <span className="text-display text-2xl">{formatPoints(player.score)}</span>
          </div>
        ))}
      </div>

      <div className="w-full max-w-2xl">
        {ranked.map((player, index) => (
          <div
            key={player.id}
            className={cn(
              'flex items-center gap-3 border-b border-stage-700/70 px-2 py-2.5 last:border-0',
              meId === player.id && 'rounded-lg bg-gold/10',
            )}
          >
            <span className="text-display w-8 text-lg text-white/50">{index + 1}.</span>
            <span className="text-xl">{player.avatar}</span>
            <span className="flex-1 truncate">{player.name}</span>
            <span className={cn('text-display text-xl', player.score < 0 && 'text-coral')}>
              {formatPoints(player.score)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
