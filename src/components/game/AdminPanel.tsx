import { Check, Eye, Gavel, Hand, Heart, Pause, Play, RotateCcw, SkipForward, X } from 'lucide-react'
import { secondsLeft, useTicker } from '@/hooks/useTicker'
import { isVowel, playerById, VOWELS } from '@/lib/engine'
import type { AdminAction, GameState, PlayerAction, Question } from '@/lib/types'
import { cn, formatPoints } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge, Panel, PanelTitle } from '@/components/ui/primitives'

const ALPHABET = 'AĄBCĆDEĘFGHIJKLŁMNŃOÓPRSŚTUWYZŹŻ'.split('')

export interface AdminPanelProps {
  state: GameState
  question: Question | null
  dispatch: (action: AdminAction) => void
  dispatchAs: (playerId: string, action: PlayerAction) => void
}

export function AdminPanel({ state, question, dispatch, dispatchAs }: AdminPanelProps) {
  const active = state.active
  if (!active) return null

  // The pack was edited mid-game and this question no longer exists.
  if (!question) {
    return (
      <Panel>
        <PanelTitle>Pytanie niedostępne</PanelTitle>
        <p className="mt-1 mb-3 text-sm text-white/60">
          To pytanie zniknęło z pakietu (edytor był otwarty w trakcie gry).
        </p>
        <Button variant="primary" onClick={() => dispatch({ type: 'closeQuestion' })}>
          Wróć do planszy
        </Button>
      </Panel>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelTitle>Klucz odpowiedzi</PanelTitle>
        <div className="mt-2 text-lg font-semibold text-mint">
          {question.kind === 'wheel'
            ? question.phrase
            : question.answerText || 'brak wpisanej odpowiedzi'}
        </div>
        {question.kind === 'standard' && question.choices?.length ? (
          <div className="mt-1 text-sm text-white/50">
            Poprawna opcja:{' '}
            {question.choices.find((c) => c.id === question.correctChoiceId)?.text ?? '—'}
          </div>
        ) : null}
        {question.notes ? <p className="mt-2 text-sm text-white/55">{question.notes}</p> : null}
      </Panel>

      {question.kind === 'standard' ? (
        <StandardControls state={state} dispatch={dispatch} dispatchAs={dispatchAs} />
      ) : null}
      {question.kind === 'wheel' ? (
        <WheelControls state={state} dispatch={dispatch} dispatchAs={dispatchAs} />
      ) : null}
      {question.kind === 'list' ? (
        <ListControls state={state} question={question} dispatch={dispatch} />
      ) : null}
      {question.kind === 'auction' ? (
        <AuctionControls state={state} question={question} dispatch={dispatch} dispatchAs={dispatchAs} />
      ) : null}

      <Panel>
        <PanelTitle>Zakończ pytanie</PanelTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => dispatch({ type: 'revealAnswer' })}>
            <Eye className="size-4" /> Pokaż odpowiedź
          </Button>
          <Button variant="primary" onClick={() => dispatch({ type: 'closeQuestion' })}>
            Wróć do planszy
          </Button>
        </div>
      </Panel>
    </div>
  )
}

function JudgeRow({
  state,
  dispatch,
  dispatchAs,
  showBuzz,
}: Omit<AdminPanelProps, 'question'> & { showBuzz?: boolean }) {
  const active = state.active
  return (
    <div className="flex flex-col gap-2">
      {state.players.map((player) => {
        const isLocked = active?.lockedPlayerId === player.id
        const wasWrong = active?.wrongPlayers.includes(player.id)
        return (
          <div
            key={player.id}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-2 py-1.5',
              isLocked ? 'border-gold/70 bg-gold/10' : 'border-stage-600',
              wasWrong && 'opacity-55',
            )}
          >
            <span>{player.avatar}</span>
            <span className="flex-1 truncate text-sm">{player.name}</span>
            {showBuzz && player.local ? (
              <Button
                size="sm"
                variant="ghost"
                title="Zgłoś tego gracza (hot-seat)"
                onClick={() => dispatchAs(player.id, { type: 'buzz' })}
              >
                <Hand className="size-4" />
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="success"
              onClick={() => dispatch({ type: 'judge', playerId: player.id, correct: true })}
            >
              <Check className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() => dispatch({ type: 'judge', playerId: player.id, correct: false })}
            >
              <X className="size-4" />
            </Button>
          </div>
        )
      })}
    </div>
  )
}

function StandardControls({ state, dispatch, dispatchAs }: Omit<AdminPanelProps, 'question'>) {
  const active = state.active
  if (!active) return null
  return (
    <>
      <Panel>
        <PanelTitle>Zgłoszenia</PanelTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant={active.buzzersOpen ? 'danger' : 'primary'}
            onClick={() => dispatch({ type: 'setBuzzers', open: !active.buzzersOpen })}
          >
            <Hand className="size-4" />
            {active.buzzersOpen ? 'Zamknij zgłoszenia' : 'Otwórz zgłoszenia'}
          </Button>
          {active.lockedPlayerId ? (
            <Button variant="outline" onClick={() => dispatch({ type: 'lockPlayer', playerId: null })}>
              Odblokuj przycisk
            </Button>
          ) : null}
        </div>
      </Panel>
      <Panel>
        <PanelTitle>Oceń odpowiedź</PanelTitle>
        <p className="mt-1 mb-2 text-xs text-white/45">
          Błąd = −{formatPoints(active.value)}.
        </p>
        <JudgeRow state={state} dispatch={dispatch} dispatchAs={dispatchAs} showBuzz />
      </Panel>
    </>
  )
}

function WheelControls({ state, dispatch, dispatchAs }: Omit<AdminPanelProps, 'question'>) {
  const wheel = state.active?.wheel
  if (!wheel) return null
  const turnId = wheel.turnPlayerId
  return (
    <>
      <Panel>
        <PanelTitle>Koło fortuny</PanelTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="primary" disabled={wheel.spinValue !== null} onClick={() => dispatch({ type: 'wheelSpin' })}>
            <RotateCcw className="size-4" /> Zakręć
          </Button>
          <Button variant="outline" onClick={() => dispatch({ type: 'wheelPassTurn' })}>
            <SkipForward className="size-4" /> Kolejka dalej
          </Button>
          <Button variant="outline" onClick={() => dispatch({ type: 'wheelRevealAll' })}>
            <Eye className="size-4" /> Odkryj hasło
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {ALPHABET.map((letter) => {
            const used = wheel.guessed.includes(letter)
            const vowel = isVowel(letter)
            return (
              <button
                key={letter}
                type="button"
                disabled={used}
                onClick={() =>
                  vowel
                    ? turnId && dispatchAs(turnId, { type: 'wheelBuyVowel', letter })
                    : dispatch({ type: 'wheelLetter', letter })
                }
                className={cn(
                  'size-8 rounded-lg border text-sm font-bold transition',
                  used
                    ? 'border-stage-700 bg-stage-900/60 text-white/20'
                    : vowel
                      ? 'border-violet-glow/60 bg-violet-glow/15 hover:bg-violet-glow/30'
                      : 'border-stage-600 bg-stage-700/70 hover:bg-tile-hot',
                )}
              >
                {letter}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-white/45">
          Fioletowe = samogłoski ({VOWELS.split('').join(' ')}) kupowane za {formatPoints(wheel.vowelCost)} z
          własnych punktów gracza (nie z puli).
        </p>
      </Panel>
      <Panel>
        <PanelTitle>Rozwiązanie hasła</PanelTitle>
        {wheel.solveAttempt ? (
          <div className="mt-2 text-lg">
            {playerById(state, wheel.solveAttempt.playerId)?.name}: „{wheel.solveAttempt.text}”
          </div>
        ) : (
          <p className="mt-1 text-sm text-white/45">
            Gracz może wysłać hasło z telefonu albo podać je na głos.
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <Button variant="success" onClick={() => dispatch({ type: 'wheelJudge', correct: true })}>
            <Check className="size-4" /> Uznaj
          </Button>
          <Button variant="danger" onClick={() => dispatch({ type: 'wheelJudge', correct: false })}>
            <X className="size-4" /> Odrzuć
          </Button>
        </div>
        {/* Tylko gracz, który ma kolej (kręci kołem), może zgłosić rozwiązanie — dotyczy też
            tego przycisku, więc zostaje tylko on (np. dla gracza hot-seat bez telefonu). */}
        {turnId ? (
          <div className="mt-3">
            <Button
              size="sm"
              variant="primary"
              onClick={() => dispatchAs(turnId, { type: 'wheelSolve', text: '(na głos)' })}
              title="Ten gracz podał hasło na głos"
            >
              {playerById(state, turnId)?.avatar} {playerById(state, turnId)?.name} podaje na głos
            </Button>
          </div>
        ) : null}
      </Panel>
    </>
  )
}

function ListControls({
  state,
  question,
  dispatch,
}: {
  state: GameState
  question: Extract<Question, { kind: 'list' }>
  dispatch: (action: AdminAction) => void
}) {
  const list = state.active?.list
  if (!list) return null
  const { listBasePayout, listPayoutStep } = state.rules
  const placementPreview = state.turnOrder
    .map((_, index) => listBasePayout - listPayoutStep * index)
    .map((amount, index) => `${index + 1}. ${formatPoints(amount)}`)
    .join(', ')
  return (
    <>
      <Panel>
        <PanelTitle>Odpowiedzi ({list.found.filter((f) => f.playerId).length}/{list.itemCount})</PanelTitle>
        <div className="mt-2 grid max-h-72 gap-1 overflow-y-auto pr-1">
          {question.items.map((item, index) => {
            const entry = list.found[index]
            const checked = Boolean(entry?.playerId)
            return (
              <button
                key={`${item}-${index}`}
                type="button"
                onClick={() => dispatch({ type: 'listToggleItem', index })}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition',
                  checked
                    ? 'border-mint/60 bg-mint/15'
                    : 'border-stage-600 hover:border-gold/50 hover:bg-white/5',
                )}
              >
                <span
                  className={cn(
                    'grid size-4 place-items-center rounded border',
                    checked ? 'border-mint bg-mint text-stage-900' : 'border-white/40',
                  )}
                >
                  {checked ? <Check className="size-3" /> : null}
                </span>
                <span className="flex-1">{item}</span>
                {entry?.playerId ? (
                  <span className="text-xs">{playerById(state, entry.playerId)?.avatar}</span>
                ) : null}
              </button>
            )
          })}
        </div>
      </Panel>
      <Panel>
        <PanelTitle>Życia i kolejność</PanelTitle>
        <div className="mt-2 flex flex-col gap-2">
          {state.players.map((player) => {
            const lives = list.lives[player.id] ?? 0
            const out = list.eliminated.includes(player.id)
            return (
              <div
                key={player.id}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-2 py-1.5',
                  list.turnPlayerId === player.id ? 'border-gold/70 bg-gold/10' : 'border-stage-600',
                  out && 'opacity-50',
                )}
              >
                <button
                  type="button"
                  className="flex flex-1 items-center gap-2 text-left text-sm"
                  onClick={() => dispatch({ type: 'listSetTurn', playerId: player.id })}
                  title="Ustaw jako odpowiadającego"
                >
                  <span>{player.avatar}</span>
                  <span className="truncate">{player.name}</span>
                </button>
                <span className="flex items-center gap-0.5 text-coral">
                  {Array.from({ length: Math.max(0, lives) }).map((_, i) => (
                    <Heart key={i} className="size-3.5 fill-coral" />
                  ))}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Dodaj życie"
                  onClick={() => dispatch({ type: 'listSetLives', playerId: player.id, lives: lives + 1 })}
                >
                  +
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  title="Pomyłka (−1 życie)"
                  onClick={() => dispatch({ type: 'listMiss', playerId: player.id })}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => dispatch({ type: 'listNextPlayer' })}>
            <SkipForward className="size-4" /> Następny gracz
          </Button>
          <Button variant="primary" disabled={list.settled} onClick={() => dispatch({ type: 'listSettle' })}>
            Rozlicz konkurencję
          </Button>
        </div>
        <p className="mt-2 text-xs text-white/45">Wypłaty za miejsca: {placementPreview}.</p>
      </Panel>
    </>
  )
}

function AuctionControls({
  state,
  question,
  dispatch,
  dispatchAs,
}: {
  state: GameState
  question: Extract<Question, { kind: 'auction' }>
  dispatch: (action: AdminAction) => void
  dispatchAs: (playerId: string, action: PlayerAction) => void
}) {
  const auction = state.active?.auction
  useTicker(Boolean(auction?.timerRunning))
  if (!auction) return null
  const remaining = secondsLeft(auction.timerEndsAt)
  return (
    <>
      <Panel>
        <PanelTitle>Licytacja</PanelTitle>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => dispatch({ type: 'auctionSetBid', bid: Math.max(0, auction.bid - 1) })}
          >
            −1
          </Button>
          <span className="text-display w-14 text-center text-2xl text-gold">{auction.bid}</span>
          <Button variant="secondary" onClick={() => dispatch({ type: 'auctionSetBid', bid: auction.bid + 1 })}>
            +1
          </Button>
          <Button
            variant="primary"
            disabled={auction.stage !== 'bidding' || !auction.leaderId}
            onClick={() => dispatch({ type: 'auctionStop' })}
          >
            <Gavel className="size-4" /> Stop licytacja
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {state.players.map((player) => (
            <Button
              key={player.id}
              size="sm"
              variant={auction.leaderId === player.id ? 'primary' : 'secondary'}
              onClick={() =>
                auction.stage === 'bidding'
                  ? dispatchAs(player.id, { type: 'auctionBid' })
                  : dispatch({ type: 'auctionSetBid', bid: auction.bid, leaderId: player.id })
              }
              title={auction.stage === 'bidding' ? 'Podbij za gracza' : 'Ustaw jako licytującego'}
            >
              {player.avatar} {player.name}
            </Button>
          ))}
        </div>
        {auction.stage !== 'bidding' ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge tone={remaining && remaining <= 10 ? 'coral' : 'gold'}>
              {remaining ?? auction.timerSeconds}s
            </Badge>
            <Button
              variant="outline"
              onClick={() => dispatch({ type: 'auctionTimer', running: !auction.timerRunning })}
            >
              {auction.timerRunning ? <Pause className="size-4" /> : <Play className="size-4" />}
              {auction.timerRunning ? 'Pauza' : 'Start'}
            </Button>
            <Button variant="ghost" onClick={() => dispatch({ type: 'auctionTimer', running: true, reset: true })}>
              <RotateCcw className="size-4" /> Reset
            </Button>
          </div>
        ) : null}
      </Panel>
      <Panel>
        <PanelTitle>
          Lista odpowiedzi ({auction.found.length}/{auction.bid || question.items.length})
        </PanelTitle>
        <div className="mt-2 grid max-h-64 gap-1 overflow-y-auto pr-1">
          {question.items.map((item, index) => {
            const checked = auction.found.includes(item)
            return (
              <button
                key={`${item}-${index}`}
                type="button"
                onClick={() => dispatch({ type: 'auctionToggleItem', index })}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-sm transition',
                  checked ? 'border-mint/60 bg-mint/15' : 'border-stage-600 hover:bg-white/5',
                )}
              >
                <span
                  className={cn(
                    'grid size-4 place-items-center rounded border',
                    checked ? 'border-mint bg-mint text-stage-900' : 'border-white/40',
                  )}
                >
                  {checked ? <Check className="size-3" /> : null}
                </span>
                {item}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="success"
            disabled={!auction.leaderId}
            onClick={() => dispatch({ type: 'auctionJudge', correct: true })}
          >
            <Check className="size-4" /> Zaliczone (+{formatPoints(state.active?.value ?? 0)})
          </Button>
          <Button
            variant="danger"
            disabled={!auction.leaderId}
            onClick={() => dispatch({ type: 'auctionJudge', correct: false })}
          >
            <X className="size-4" /> Niezaliczone
          </Button>
        </div>
      </Panel>
    </>
  )
}
