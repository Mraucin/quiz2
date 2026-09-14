import { CheckCircle2, Circle, Hourglass, Lock, Trophy } from 'lucide-react'
import { MediaView, SpeakButton } from '@/components/game/MediaView'
import { PhraseBoard, Wheel } from '@/components/game/Wheel'
import { Badge } from '@/components/ui/primitives'
import { secondsLeft, useTicker } from '@/hooks/useTicker'
import { playerById } from '@/lib/engine'
import type { GameState, Question } from '@/lib/types'
import { cn, formatPoints } from '@/lib/utils'

const letters = ['A', 'B', 'C', 'D', 'E', 'F']

/** Main-screen view of an estimation round — see `EstimationRuntime`. */
export function EstimationStage({ state }: { state: GameState }) {
  const est = state.estimation
  if (!est) return null
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone="gold" className="text-sm">
          Runda oszacowania
        </Badge>
        {est.unit ? <Badge>Jednostka: {est.unit}</Badge> : null}
      </div>
      <p className="text-balance text-2xl leading-snug font-semibold sm:text-4xl">{est.prompt}</p>
      {est.media ? <MediaView media={est.media} /> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        {est.eligiblePlayerIds.map((playerId) => {
          const player = playerById(state, playerId)
          const guess = est.guesses[playerId]
          const submitted = guess !== undefined
          const diff =
            est.revealed && submitted && est.correctAnswer !== undefined
              ? Math.abs(guess - est.correctAnswer)
              : null
          const isWinner = est.winnerIds?.includes(playerId)
          return (
            <div
              key={playerId}
              className={cn(
                'panel flex items-center gap-3 px-3 py-2',
                isWinner && 'border-gold bg-gold/10',
              )}
            >
              <span className="text-xl">{player?.avatar}</span>
              <span className="flex-1 truncate">{player?.name}</span>
              {est.revealed ? (
                <span className="text-display text-lg">
                  {submitted ? `${guess}${est.unit ? ` ${est.unit}` : ''}` : 'brak odpowiedzi'}
                  {diff !== null ? <span className="ml-2 text-xs text-white/50">(±{diff})</span> : null}
                </span>
              ) : (
                <Badge tone={submitted ? 'mint' : 'neutral'}>{submitted ? 'gotowe' : 'czeka…'}</Badge>
              )}
              {isWinner ? <Trophy className="size-4 text-gold" /> : null}
            </div>
          )
        })}
      </div>
      {est.revealed && est.correctAnswer !== undefined ? (
        <div className="animate-pop rounded-card border border-mint/60 bg-mint/10 p-4">
          <div className="text-xs tracking-[0.2em] text-mint uppercase">Poprawna odpowiedź</div>
          <div className="text-display text-2xl">
            {est.correctAnswer}
            {est.unit ? ` ${est.unit}` : ''}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function QuestionStage({
  state,
  question,
  skewMs = 0,
}: {
  state: GameState
  /** Full question from the pack — host only (holds the answers and uploaded media). */
  question?: Question | null
  skewMs?: number
}) {
  const active = state.active
  useTicker(Boolean(active?.auction?.timerRunning) || Boolean(active?.assignment?.timerEndsAt))
  if (!active) return null

  const locked = playerById(state, active.lockedPlayerId)
  const assignment = active.assignment
  const timerRemaining = secondsLeft(assignment?.timerEndsAt, skewMs)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge tone="gold" className="text-sm">
            {active.categoryName}
          </Badge>
          <span className="text-display text-3xl text-gold">{formatPoints(active.value)}</span>
        </div>
        <div className="flex items-center gap-2">
          {assignment && active.stage === 'reading' ? (
            <Badge>
              <Hourglass className="size-3" /> Czytanie pytania — dla{' '}
              {playerById(state, assignment.assignedPlayerId)?.name ?? '—'}
            </Badge>
          ) : null}
          {locked ? (
            <Badge tone="violet">
              <Lock className="size-3" /> Odpowiada: {locked.avatar} {locked.name}
            </Badge>
          ) : null}
          {timerRemaining !== null ? (
            <Badge tone={timerRemaining <= 5 ? 'coral' : 'gold'}>{timerRemaining}s</Badge>
          ) : null}
        </div>
      </div>

      <p className="text-balance text-2xl leading-snug font-semibold sm:text-4xl">{active.prompt}</p>

      {question?.media ? <MediaView media={question.media} /> : null}
      {active.speak && !question?.media ? (
        <div className="flex items-center gap-3">
          <SpeakButton text={active.speak} />
          <span className="text-sm text-white/50">
            Kategoria audio — puść nagranie albo odczytaj hasło na głos.
          </span>
        </div>
      ) : null}

      {active.choices?.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {active.choices.map((choice, index) => {
            const pickedBy = state.players.filter((p) => active.selections[p.id] === choice.id)
            const isCorrect = active.answerRevealed && active.correctChoiceId === choice.id
            return (
              <div
                key={choice.id}
                className={cn(
                  'flex items-center gap-3 rounded-card border px-4 py-3 text-lg transition',
                  isCorrect
                    ? 'border-mint bg-mint/15 text-white'
                    : 'border-stage-600 bg-stage-800/60',
                )}
              >
                <span className="text-display grid size-9 shrink-0 place-items-center rounded-lg bg-black/30 text-gold">
                  {letters[index]}
                </span>
                <span className="flex-1">{choice.text}</span>
                <span className="flex gap-1">
                  {pickedBy.map((player) => (
                    <span key={player.id} title={player.name}>
                      {player.avatar}
                    </span>
                  ))}
                </span>
                {isCorrect ? <CheckCircle2 className="size-5 text-mint" /> : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {!active.choices?.length && Object.keys(active.openAnswers).length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(active.openAnswers).map(([playerId, text]) => {
            const player = playerById(state, playerId)
            return (
              <div key={playerId} className="panel px-3 py-2">
                <div className="text-xs text-white/50">
                  {player?.avatar} {player?.name}
                </div>
                <div className="text-lg">{text || '—'}</div>
              </div>
            )
          })}
        </div>
      ) : null}

      {active.wheel ? <WheelStage state={state} /> : null}
      {active.list ? <ListStage state={state} /> : null}
      {active.auction ? <AuctionStage state={state} skewMs={skewMs} /> : null}

      {assignment && assignment.takeoverQueue.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-white/60">
          Kolejka przejęcia:
          {assignment.takeoverQueue.map((playerId, index) => {
            const player = playerById(state, playerId)
            return (
              <Badge key={playerId} tone={index === 0 ? 'gold' : 'neutral'}>
                {index + 1}. {player?.avatar} {player?.name}
              </Badge>
            )
          })}
        </div>
      ) : null}

      {active.answerRevealed ? (
        <div className="animate-pop rounded-card border border-mint/60 bg-mint/10 p-4">
          <div className="text-xs tracking-[0.2em] text-mint uppercase">Poprawna odpowiedź</div>
          <div className="text-display text-2xl">{active.answerText || '—'}</div>
          {question?.answerMedia ? <MediaView media={question.answerMedia} className="mt-3" /> : null}
          {question?.notes ? <p className="mt-2 text-sm text-white/60">{question.notes}</p> : null}
        </div>
      ) : null}
    </div>
  )
}

function WheelStage({ state }: { state: GameState }) {
  const wheel = state.active?.wheel
  if (!wheel) return null
  const turn = playerById(state, wheel.turnPlayerId)
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="flex flex-col items-center gap-4">
        <PhraseBoard masked={wheel.masked} hint={wheel.hint} />
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Badge tone="gold">Pula: {formatPoints(wheel.pool)}</Badge>
          <Badge tone={wheel.spinValue ? 'mint' : 'neutral'}>
            {wheel.spinValue ? `Koło: ${wheel.spinValue} — podaj spółgłoskę` : 'Zakręć kołem'}
          </Badge>
          <Badge tone="violet">Samogłoska: {formatPoints(wheel.vowelCost)}</Badge>
          {turn ? (
            <Badge>
              Kręci: {turn.avatar} {turn.name}
            </Badge>
          ) : null}
        </div>
        {wheel.guessed.length ? (
          <div className="text-sm text-white/45">Litery: {wheel.guessed.join(' · ')}</div>
        ) : null}
        {wheel.message ? <div className="text-center text-lg text-gold">{wheel.message}</div> : null}
        {wheel.solveAttempt ? (
          <div className="animate-pop panel px-4 py-3 text-center">
            <div className="text-xs text-white/50">
              {playerById(state, wheel.solveAttempt.playerId)?.name} rozwiązuje:
            </div>
            <div className="text-display text-2xl text-gold">{wheel.solveAttempt.text}</div>
          </div>
        ) : null}
      </div>
      <Wheel index={wheel.spinIndex} nonce={wheel.spinNonce} />
    </div>
  )
}

function ListStage({ state }: { state: GameState }) {
  const list = state.active?.list
  if (!list) return null
  const turn = playerById(state, list.turnPlayerId)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="gold">
          Pula: {formatPoints(list.pool)} · {list.found.filter((f) => f.playerId).length}/
          {list.itemCount}
        </Badge>
        {turn && !list.settled ? (
          <Badge tone="mint" className="animate-glow">
            Teraz odpowiada: {turn.avatar} {turn.name}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {state.players.map((player) => {
          const lives = list.lives[player.id] ?? 0
          const out = list.eliminated.includes(player.id)
          return (
            <div
              key={player.id}
              className={cn(
                'panel flex items-center gap-2 px-3 py-2 text-sm',
                out && 'opacity-40 line-through',
              )}
            >
              <span>{player.avatar}</span>
              <span>{player.name}</span>
              <span className="flex gap-0.5">
                {Array.from({ length: Math.max(lives, 0) }).map((_, index) => (
                  <span key={index} className="text-coral">
                    ♥
                  </span>
                ))}
              </span>
            </div>
          )
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.found.map((entry, index) => (
          <div
            key={index}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
              entry.playerId
                ? 'border-mint/50 bg-mint/10'
                : 'border-stage-600 bg-stage-900/40 text-white/30',
            )}
          >
            {entry.playerId ? (
              <CheckCircle2 className="size-4 shrink-0 text-mint" />
            ) : (
              <Circle className="size-4 shrink-0" />
            )}
            <span className="flex-1">{entry.text || `Odpowiedź ${index + 1}`}</span>
            {entry.playerId ? (
              <span className="text-xs">{playerById(state, entry.playerId)?.avatar}</span>
            ) : null}
          </div>
        ))}
      </div>
      {list.settled ? (
        <div className="animate-pop grid gap-2 sm:grid-cols-2">
          {list.payouts.map((payout) => {
            const player = playerById(state, payout.playerId)
            return (
              <div
                key={payout.playerId}
                className={cn(
                  'flex items-center gap-3 rounded-card border px-4 py-2',
                  payout.delta > 0
                    ? 'border-mint/60 bg-mint/10'
                    : payout.delta < 0
                      ? 'border-coral/60 bg-coral/10'
                      : 'border-stage-600',
                )}
              >
                <span className="text-display text-xl text-gold">{payout.place}.</span>
                <span className="flex-1">
                  {player?.avatar} {player?.name}
                </span>
                <span className="text-display text-xl">
                  {payout.delta > 0 ? '+' : ''}
                  {formatPoints(payout.delta)}
                </span>
                {payout.place === 1 ? <Trophy className="size-4 text-gold" /> : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function AuctionStage({ state, skewMs }: { state: GameState; skewMs: number }) {
  const auction = state.active?.auction
  useTicker(Boolean(auction?.timerRunning))
  if (!auction) return null
  const leader = playerById(state, auction.leaderId)
  const remaining = secondsLeft(auction.timerEndsAt, skewMs)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="panel px-5 py-3 text-center">
          <div className="text-xs tracking-widest text-white/50 uppercase">Licytacja</div>
          <div className="text-display text-4xl text-gold">{auction.bid}</div>
        </div>
        <div className="panel px-5 py-3">
          <div className="text-xs tracking-widest text-white/50 uppercase">Prowadzi</div>
          <div className="text-display text-2xl">
            {leader ? `${leader.avatar} ${leader.name}` : '—'}
          </div>
        </div>
        {auction.stage !== 'bidding' && remaining !== null ? (
          <div
            className={cn(
              'panel px-5 py-3 text-center',
              remaining <= 10 && auction.timerRunning && 'border-coral/70',
            )}
          >
            <div className="text-xs tracking-widest text-white/50 uppercase">Czas</div>
            <div className={cn('text-display text-4xl', remaining <= 10 ? 'text-coral' : 'text-white')}>
              {remaining}s
            </div>
          </div>
        ) : null}
        <Badge tone={auction.stage === 'bidding' ? 'mint' : 'violet'}>
          {auction.stage === 'bidding'
            ? 'Podbijajcie na swoich telefonach'
            : auction.stage === 'listing'
              ? `Wymień ${auction.bid} odpowiedzi`
              : 'Rozliczone'}
        </Badge>
      </div>
      {auction.found.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {auction.found.map((item) => (
            <Badge key={item} tone="mint" className="text-sm">
              <CheckCircle2 className="size-3" /> {item}
            </Badge>
          ))}
          <Badge>
            {auction.found.length}/{auction.bid} podanych
          </Badge>
        </div>
      ) : null}
    </div>
  )
}
