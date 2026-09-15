import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Gavel, RotateCcw, Send, Wifi } from 'lucide-react'
import { BoardGrid } from '@/components/game/BoardGrid'
import { MediaView } from '@/components/game/MediaView'
import { PhraseBoard, Wheel, WHEEL_SPIN_MS } from '@/components/game/Wheel'
import { PlayerStrip } from '@/components/game/PlayerStrip'
import { Results } from '@/components/game/Results'
import { Button } from '@/components/ui/button'
import { Badge, Input, Panel, PanelTitle } from '@/components/ui/primitives'
import { usePlayerGame } from '@/hooks/usePlayerGame'
import { clockSkew, secondsLeft, useTicker } from '@/hooks/useTicker'
import { AVATARS } from '@/lib/defaultPack'
import { boardRemaining, isVowel, maxWager, playerById } from '@/lib/engine'
import { recallPlayer } from '@/lib/storage'
import type { GameState, Player, PlayerAction } from '@/lib/types'
import { cn, formatPoints } from '@/lib/utils'

const CONSONANTS = 'BCĆDFGHJKLŁMNŃPRSŚTWZŹŻ'.split('')
const VOWEL_KEYS = 'AĄEĘIOÓUY'.split('')
const letters = ['A', 'B', 'C', 'D', 'E', 'F']

export function PlayScreen({
  initialCode,
  navigate,
}: {
  initialCode: string
  navigate: (path: string) => void
}) {
  const { status, error, state, playerId, me, transport, join, send } = usePlayerGame()
  const remembered = useMemo(() => recallPlayer(), [])
  const [code, setCode] = useState(initialCode || remembered?.code || '')
  const [name, setName] = useState(remembered?.name ?? '')
  const [avatar, setAvatar] = useState(remembered?.avatar ?? AVATARS[0])

  // Once we've successfully joined, keep showing the game even if the connection drops for a
  // moment (host tab reload, flaky wifi) — `usePlayerGame` keeps retrying in the background
  // and `state`/`me` stay as they were, so there's nothing to re-render here except a small
  // banner (below) letting the player know we're reconnecting.
  if (!state || !me) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="size-4" />
          </Button>
          <div className="text-display text-2xl text-gold">Dołącz do gry</div>
        </div>
        <Panel className="flex flex-col gap-4">
          <div>
            <PanelTitle>Kod pokoju</PanelTitle>
            <Input
              className="mt-1 text-display text-center text-2xl tracking-[0.3em] uppercase"
              value={code}
              maxLength={6}
              placeholder="ABC12"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </div>
          <div>
            <PanelTitle>Twój nick</PanelTitle>
            <Input
              className="mt-1"
              value={name}
              maxLength={20}
              placeholder="np. Zenek"
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div>
            <PanelTitle>Ikona</PanelTitle>
            <div className="mt-2 grid grid-cols-8 gap-1">
              {AVATARS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setAvatar(icon)}
                  className={cn(
                    'grid h-9 place-items-center rounded-lg border text-xl transition',
                    avatar === icon
                      ? 'border-gold bg-gold/20'
                      : 'border-stage-600 hover:border-gold/50',
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="primary"
            size="lg"
            disabled={status === 'connecting' || code.length < 4 || !name.trim()}
            onClick={() => join(code.trim(), name.trim(), avatar)}
          >
            {status === 'connecting' ? 'Łączę…' : 'Wchodzę do lobby'}
          </Button>
          {error ? <p className="text-sm text-coral">{error}</p> : null}
          <p className="text-xs text-white/45">
            Kod znajdziesz na ekranie prowadzącego. Jeśli gra jest otwarta w tej samej przeglądarce,
            połączenie zadziała nawet bez internetu.
          </p>
        </Panel>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-screen w-full min-w-[1600px] max-w-[1600px] flex-col gap-3 p-3 pb-10">
      <header className="panel flex items-center gap-3 px-3 py-2">
        <span
          className="grid size-11 place-items-center rounded-full text-2xl"
          style={{
            background: `color-mix(in oklch, ${me.color} 28%, transparent)`,
            boxShadow: `inset 0 0 0 2px ${me.color}`,
          }}
        >
          {me.avatar}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{me.name}</div>
          <div className={cn('text-display text-2xl leading-none', me.score < 0 && 'text-coral')}>
            {formatPoints(me.score)}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={transport === 'peer' ? 'mint' : 'violet'}>
            <Wifi className="size-3" /> {transport === 'peer' ? 'online' : 'lokalnie'}
          </Badge>
        </div>
      </header>

      {status === 'reconnecting' ? (
        <div className="panel flex items-center gap-2 border-gold/50 bg-gold/10 px-3 py-2 text-sm text-gold">
          <span className="animate-buzz size-2 rounded-full bg-gold" />
          Łączę ponownie z hostem… Twoje miejsce w grze jest zachowane.
        </div>
      ) : null}

      <PlayerStrip state={state} highlightId={state.currentPlayerId} meId={me.id} compact />

      <PlayerBody state={state} me={me} playerId={playerId} send={send} />
    </div>
  )
}

function PlayerBody({
  state,
  me,
  playerId,
  send,
}: {
  state: GameState
  me: Player
  playerId: string | null
  send: (action: PlayerAction) => void
}) {
  const skew = clockSkew(state)
  if (state.phase === 'lobby') {
    return (
      <Panel className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="text-display text-2xl text-gold">Jesteś w lobby</div>
        <p className="text-sm text-white/60">
          Czekamy na prowadzącego. Trzymaj telefon pod ręką — zaraz będziesz się zgłaszać,
          licytować i obstawiać.
        </p>
        <div className="animate-buzz size-3 rounded-full bg-gold" />
      </Panel>
    )
  }

  if (state.phase === 'results') return <Results state={state} meId={me.id} />

  if (state.phase === 'final' && state.final) {
    return (
      <FinalPlayerView
        key={state.final.index}
        state={state}
        me={me}
        send={send}
        skew={skew}
      />
    )
  }

  if (state.phase === 'estimation') {
    return <EstimationPlayerView state={state} me={me} send={send} />
  }

  if (state.phase === 'board' || !state.active) {
    const myTurn = state.currentPlayerId === me.id
    const current = playerById(state, state.currentPlayerId)
    const remaining = boardRemaining(state)
    return (
      <Panel className="flex flex-col gap-3">
        <PanelTitle>
          {remaining === 0
            ? 'Plansza wyczerpana — szykuj się na finał'
            : myTurn
              ? 'Twoja kolej — powiedz prowadzącemu, co wybierasz'
              : `Wybiera ${current?.name ?? 'prowadzący'}`}
        </PanelTitle>
        {/* Read-only: only the admin taps tiles on `/admin` to open a question. */}
        <BoardGrid state={state} compact disabled />
      </Panel>
    )
  }

  const active = state.active
  const assignment = active.assignment
  // Privacy twist: while the admin is reading a standard question, only the assignee's phone
  // shows it — everyone else just sees who's up and waits to find out if they answer. Once the
  // timer starts, the question is fair game for a takeover, so everyone can see it.
  const hidePrompt =
    active.kind === 'standard' &&
    active.stage === 'reading' &&
    Boolean(assignment) &&
    assignment?.assignedPlayerId !== me.id

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <div className="flex items-center justify-between gap-2">
          <Badge tone="gold">{active.categoryName}</Badge>
          <span className="text-display text-xl text-gold">{formatPoints(active.value)}</span>
        </div>
        {hidePrompt ? (
          <p className="mt-3 text-sm text-white/50">
            Prowadzący czyta teraz pytanie tylko dla{' '}
            {playerById(state, assignment?.assignedPlayerId)?.name ?? 'wyznaczonego gracza'}.
          </p>
        ) : (
          <>
            <p className="mt-3 text-lg leading-snug font-semibold">{active.prompt}</p>
            {active.media?.src ? (
              <MediaView media={active.media} className="mt-3" hideLabel />
            ) : active.media ? (
              <p className="mt-2 text-sm text-white/50">Materiał odtwarza prowadzący na dużym ekranie.</p>
            ) : null}
          </>
        )}
        {active.answerRevealed ? (
          <div className="mt-3 rounded-xl border border-mint/60 bg-mint/10 p-3">
            <div className="text-xs text-mint uppercase">Poprawna odpowiedź</div>
            <div className="text-lg font-semibold">{active.answerText}</div>
            {active.answerMedia?.src ? (
              <MediaView media={active.answerMedia} className="mt-3" hideLabel />
            ) : null}
          </div>
        ) : null}
      </Panel>

      {active.kind === 'standard' ? <StandardPlayerControls state={state} me={me} send={send} /> : null}
      {active.kind === 'wheel' ? <WheelPlayerControls state={state} me={me} send={send} /> : null}
      {active.kind === 'list' ? <ListPlayerView state={state} me={me} /> : null}
      {active.kind === 'auction' ? (
        <AuctionPlayerControls state={state} me={me} playerId={playerId} send={send} skew={skew} />
      ) : null}
    </div>
  )
}

function StandardPlayerControls({
  state,
  me,
  send,
}: {
  state: GameState
  me: Player
  send: (action: PlayerAction) => void
}) {
  const active = state.active
  const [draft, setDraft] = useState('')
  if (!active || !active.assignment) return null
  const assignment = active.assignment
  const isHolder = active.lockedPlayerId === me.id
  const isAssignee = assignment.assignedPlayerId === me.id
  const holder = playerById(state, active.lockedPlayerId)
  const mySelection = active.selections[me.id]
  const alreadyAttempted = assignment.attempted.includes(me.id)
  const inQueue = assignment.takeoverQueue.includes(me.id)
  const takeoverCapReached = state.takeoversUsed >= 4
  const takeoverEligible = Boolean(active.choices && active.choices.length > 2)
  const canRequestTakeover =
    active.stage === 'locked' &&
    !isHolder &&
    !alreadyAttempted &&
    !inQueue &&
    !takeoverCapReached &&
    takeoverEligible

  if (active.stage === 'reading') {
    return (
      <Panel className="flex flex-col items-center gap-3 py-8 text-center">
        {isAssignee ? (
          <>
            <div className="text-display text-xl text-mint">To pytanie jest dla Ciebie!</div>
            <p className="text-sm text-white/60">
              Prowadzący zaraz zacznie odliczanie — przygotuj się na odpowiedź.
            </p>
          </>
        ) : (
          <>
            <div className="text-display text-xl text-gold">Prowadzący czyta pytanie…</div>
            <p className="text-sm text-white/60">
              Odpowiada {playerById(state, assignment.assignedPlayerId)?.avatar}{' '}
              {playerById(state, assignment.assignedPlayerId)?.name}.
            </p>
          </>
        )}
      </Panel>
    )
  }

  if (active.stage === 'resolved') {
    return <Panel className="text-center text-sm text-white/60">Pytanie rozliczone.</Panel>
  }

  if (isHolder) {
    return (
      <Panel className="flex flex-col gap-3">
        <div className="text-center text-display text-xl text-mint">Masz głos!</div>
        {active.choices?.length ? (
          <div className="grid gap-2">
            {active.choices.map((choice, index) => (
              <Button
                key={choice.id}
                size="lg"
                variant={mySelection === choice.id ? 'primary' : 'secondary'}
                className="justify-start text-left"
                onClick={() => send({ type: 'choose', choiceId: choice.id })}
              >
                <span className="text-display mr-2 text-gold">{letters[index]}</span>
                {choice.text}
              </Button>
            ))}
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              send({ type: 'openAnswer', text: draft })
            }}
          >
            <Input
              placeholder="Wpisz odpowiedź (albo powiedz na głos)"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" variant="primary">
              <Send className="size-4" />
            </Button>
          </form>
        )}
        <p className="text-center text-xs text-white/45">
          Prowadzący ocenia odpowiedź. Błąd = −{formatPoints(active.value)}.
        </p>
      </Panel>
    )
  }

  return (
    <Panel className="flex flex-col items-center gap-3 py-6">
      <p className="text-center text-sm text-white/55">
        Odpowiada {holder?.avatar} {holder?.name}
      </p>
      {alreadyAttempted ? (
        <Badge tone="coral">Już próbowałeś/aś to pytanie</Badge>
      ) : inQueue ? (
        <Badge tone="gold" className="animate-glow">
          Jesteś w kolejce do przejęcia
        </Badge>
      ) : canRequestTakeover ? (
        <Button size="lg" variant="primary" onClick={() => send({ type: 'requestTakeover' })}>
          Przejmij pytanie
        </Button>
      ) : !takeoverEligible ? (
        <p className="text-center text-xs text-white/40">
          Tego pytania nie można przejąć (za mało odpowiedzi).
        </p>
      ) : takeoverCapReached ? (
        <p className="text-center text-xs text-white/40">Limit przejęć na tę grę został wykorzystany.</p>
      ) : null}
    </Panel>
  )
}

function EstimationPlayerView({
  state,
  me,
  send,
}: {
  state: GameState
  me: Player
  send: (action: PlayerAction) => void
}) {
  const est = state.estimation
  const [draft, setDraft] = useState('')
  if (!est) return null
  const eligible = est.eligiblePlayerIds.includes(me.id)
  const myGuess = est.guesses[me.id]

  if (!eligible) {
    return (
      <Panel className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="text-display text-xl text-gold">Dogrywka bez Ciebie</div>
        <p className="text-sm text-white/60">
          Ta runda oszacowania jest tylko dla graczy, którzy zremisowali. Czekaj na wynik.
        </p>
      </Panel>
    )
  }

  return (
    <Panel className="flex flex-col gap-3">
      <PanelTitle>Runda oszacowania</PanelTitle>
      <p className="text-lg font-semibold">{est.prompt}</p>
      {est.media?.src ? <MediaView media={est.media} className="mt-1" hideLabel /> : null}
      {!est.revealed ? (
        myGuess !== undefined ? (
          <div className="text-center">
            <div className="text-display text-3xl text-gold">
              {myGuess}
              {est.unit ? ` ${est.unit}` : ''}
            </div>
            <p className="text-sm text-white/55">Odpowiedź zapisana. Czekaj na resztę graczy.</p>
          </div>
        ) : (
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const amount = Number(draft.replace(',', '.'))
              if (Number.isNaN(amount)) return
              send({ type: 'estimateGuess', amount })
            }}
          >
            <Input
              inputMode="decimal"
              placeholder={est.unit ? `Twoja liczba (${est.unit})` : 'Twoja liczba'}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <Button type="submit" variant="primary">
              <Send className="size-4" />
            </Button>
          </form>
        )
      ) : (
        <div className="text-center">
          <div className="text-xs text-mint uppercase">Poprawna odpowiedź</div>
          <div className="text-display text-2xl">
            {est.correctAnswer}
            {est.unit ? ` ${est.unit}` : ''}
          </div>
          <p className="mt-2 text-sm text-white/60">
            {est.winnerIds?.includes(me.id) ? 'Trafiłeś/aś najbliżej!' : 'Tym razem nie wygrałeś/aś.'}
          </p>
        </div>
      )}
    </Panel>
  )
}

function WheelPlayerControls({
  state,
  me,
  send,
}: {
  state: GameState
  me: Player
  send: (action: PlayerAction) => void
}) {
  const wheel = state.active?.wheel
  const [solution, setSolution] = useState('')
  const [spinning, setSpinning] = useState(false)
  const lastNonceRef = useRef(wheel?.spinNonce)
  useEffect(() => {
    if (!wheel) return
    if (lastNonceRef.current === wheel.spinNonce) return
    lastNonceRef.current = wheel.spinNonce
    setSpinning(true)
    const timer = setTimeout(() => setSpinning(false), WHEEL_SPIN_MS + 100)
    return () => clearTimeout(timer)
  }, [wheel?.spinNonce])
  if (!wheel) return null
  const myTurn = wheel.turnPlayerId === me.id
  const turn = playerById(state, wheel.turnPlayerId)
  const canGuessLetter = wheel.spinValue !== null && !spinning

  return (
    <Panel className="flex flex-col gap-3">
      <PhraseBoard masked={wheel.masked} hint={wheel.hint} />
      <div className="flex justify-center">
        <Wheel index={wheel.spinIndex} nonce={wheel.spinNonce} size={200} />
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Badge tone="gold">Pula: {formatPoints(wheel.pool)}</Badge>
        <Badge tone={wheel.spinValue ? 'mint' : 'neutral'}>
          {wheel.spinValue ? `Koło: ${wheel.spinValue}` : 'Zakręć kołem'}
        </Badge>
        <Badge>{myTurn ? 'Twoja kolej' : `Kręci ${turn?.name ?? '—'}`}</Badge>
      </div>
      {wheel.message ? <p className="text-center text-sm text-gold">{wheel.message}</p> : null}

      {myTurn ? (
        <>
          <Button
            variant="primary"
            size="lg"
            disabled={wheel.spinValue !== null || spinning}
            onClick={() => send({ type: 'wheelSpin' })}
          >
            <RotateCcw className="size-5" /> Zakręć kołem
          </Button>
          <div>
            <PanelTitle>
              Spółgłoska {canGuessLetter ? '' : spinning ? '(koło się jeszcze kręci)' : '(najpierw zakręć)'}
            </PanelTitle>
            <div className="mt-1 grid grid-cols-8 gap-1">
              {CONSONANTS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  disabled={wheel.guessed.includes(letter) || !canGuessLetter}
                  onClick={() => send({ type: 'wheelLetter', letter })}
                  className={cn(
                    'h-9 rounded-lg border text-sm font-bold',
                    wheel.guessed.includes(letter)
                      ? 'border-stage-700 bg-stage-900/60 text-white/20'
                      : 'border-stage-600 bg-stage-700/70 active:bg-gold active:text-stage-900 disabled:opacity-40',
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
          <div>
            <PanelTitle>
              Kup samogłoskę za {formatPoints(wheel.vowelCost)} pkt (z Twoich punktów)
            </PanelTitle>
            <div className="mt-1 grid grid-cols-9 gap-1">
              {VOWEL_KEYS.map((letter) => (
                <button
                  key={letter}
                  type="button"
                  disabled={
                    wheel.guessed.includes(letter) || !isVowel(letter) || me.score < wheel.vowelCost
                  }
                  onClick={() => send({ type: 'wheelBuyVowel', letter })}
                  className={cn(
                    'h-9 rounded-lg border text-sm font-bold',
                    wheel.guessed.includes(letter)
                      ? 'border-stage-700 bg-stage-900/60 text-white/20'
                      : 'border-violet-glow/60 bg-violet-glow/20 active:bg-violet-glow active:text-stage-900',
                  )}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="text-center text-sm text-white/45">
          Czekasz na swoją turę — kręci i odpowiada {turn?.name ?? 'ktoś inny'}.
        </p>
      )}

      {myTurn ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!solution.trim()) return
            send({ type: 'wheelSolve', text: solution.trim() })
            setSolution('')
          }}
        >
          <Input
            placeholder="Rozwiązuję hasło…"
            value={solution}
            onChange={(event) => setSolution(event.target.value)}
          />
          <Button type="submit" variant="primary">
            <Send className="size-4" />
          </Button>
        </form>
      ) : null}
      {wheel.solveAttempt ? (
        <p className="text-center text-sm text-white/60">
          {playerById(state, wheel.solveAttempt.playerId)?.name} podał: „{wheel.solveAttempt.text}”
        </p>
      ) : null}
    </Panel>
  )
}

function ListPlayerView({ state, me }: { state: GameState; me: Player }) {
  const list = state.active?.list
  if (!list) return null
  const turn = playerById(state, list.turnPlayerId)
  const myLives = list.lives[me.id] ?? 0
  const out = list.eliminated.includes(me.id)

  return (
    <Panel className="flex flex-col gap-3">
      <PanelTitle>Wyliczanka — odpowiadacie na głos, po kolei</PanelTitle>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={turn?.id === me.id ? 'mint' : 'neutral'} className={turn?.id === me.id ? 'animate-glow' : ''}>
          {turn?.id === me.id ? 'TWOJA KOLEJ!' : `Teraz: ${turn?.name ?? '—'}`}
        </Badge>
        <Badge tone="gold">Pula: {formatPoints(list.pool)}</Badge>
        <Badge>
          {list.found.filter((f) => f.playerId).length}/{list.itemCount} odpowiedzi
        </Badge>
      </div>
      <div className="flex items-center gap-2 text-sm">
        Twoje życia:
        <span className="text-coral">{'♥'.repeat(Math.max(0, myLives)) || '—'}</span>
        {out ? <Badge tone="coral">odpadłeś</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {list.found
          .filter((entry) => entry.playerId)
          .map((entry, index) => (
            <Badge key={index} tone="mint">
              {entry.text}
            </Badge>
          ))}
      </div>
      {list.settled ? (
        <div className="flex flex-col gap-1">
          {list.payouts.map((payout) => {
            const player = playerById(state, payout.playerId)
            return (
              <div key={payout.playerId} className="flex items-center gap-2 text-sm">
                <span className="text-display w-6 text-gold">{payout.place}.</span>
                <span className="flex-1">
                  {player?.avatar} {player?.name}
                </span>
                <span className={cn('text-display', payout.delta < 0 ? 'text-coral' : 'text-mint')}>
                  {payout.delta > 0 ? '+' : ''}
                  {formatPoints(payout.delta)}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </Panel>
  )
}

function AuctionPlayerControls({
  state,
  me,
  send,
  skew,
}: {
  state: GameState
  me: Player
  playerId: string | null
  send: (action: PlayerAction) => void
  skew: number
}) {
  const auction = state.active?.auction
  useTicker(Boolean(auction?.timerRunning))
  if (!auction) return null
  const leader = playerById(state, auction.leaderId)
  const remaining = secondsLeft(auction.timerEndsAt, skew)
  const iLead = auction.leaderId === me.id

  return (
    <Panel className="flex flex-col items-center gap-3">
      <div className="text-center">
        <div className="text-xs tracking-widest text-white/50 uppercase">Aktualna licytacja</div>
        <div className="text-display text-5xl text-gold">{auction.bid}</div>
        <div className="text-sm text-white/60">
          {leader ? `Prowadzi ${leader.avatar} ${leader.name}` : 'Nikt jeszcze nie licytował'}
        </div>
      </div>
      {auction.stage === 'bidding' ? (
        <Button
          size="xl"
          variant={iLead ? 'secondary' : 'primary'}
          disabled={iLead}
          onClick={() => send({ type: 'auctionBid' })}
          className="w-full"
        >
          <Gavel className="size-5" />
          {iLead ? 'Prowadzisz licytację' : `Podbijam na ${auction.bid + 1}`}
        </Button>
      ) : (
        <>
          <Badge tone={iLead ? 'mint' : 'neutral'} className="text-sm">
            {iLead ? `Wymień ${auction.bid} odpowiedzi!` : `${leader?.name ?? '—'} wymienia odpowiedzi`}
          </Badge>
          {remaining !== null ? (
            <div className={cn('text-display text-4xl', remaining <= 10 ? 'text-coral' : 'text-white')}>
              {remaining}s
            </div>
          ) : null}
          <div className="flex flex-wrap justify-center gap-1.5">
            {auction.found.map((item) => (
              <Badge key={item} tone="mint">
                {item}
              </Badge>
            ))}
          </div>
        </>
      )}
      <p className="text-center text-xs text-white/45">
        Za trafienie wszystkich: +{formatPoints(state.active?.value ?? 0)}. Pudło: tyle samo na minus.
      </p>
    </Panel>
  )
}

function FinalPlayerView({
  state,
  me,
  send,
  skew,
}: {
  state: GameState
  me: Player
  send: (action: PlayerAction) => void
  skew: number
}) {
  const final = state.final
  useTicker(Boolean(final?.stage === 'answering'))
  const [wager, setWager] = useState('')
  const [answer, setAnswer] = useState('')
  if (!final) return null
  const limit = maxWager(me)
  const myWager = final.wagers[me.id]
  const remaining = secondsLeft(final.timerEndsAt, skew)

  return (
    <div className="flex flex-col gap-3">
      <Panel className="text-center">
        <div className="text-xs tracking-[0.25em] text-white/50 uppercase">
          Finał {final.index + 1}/{final.total}
        </div>
        <div className="text-display text-3xl text-gold">{final.category}</div>
        {final.prompt ? <p className="mt-3 text-lg font-semibold">{final.prompt}</p> : null}
        {final.media?.src && final.prompt ? (
          <MediaView media={final.media} className="mt-3" hideLabel />
        ) : null}
        {remaining !== null && final.stage === 'answering' ? (
          <div className={cn('text-display mt-2 text-4xl', remaining <= 10 ? 'text-coral' : 'text-white')}>
            {remaining}s
          </div>
        ) : null}
      </Panel>

      {final.stage === 'category' || final.stage === 'wagering' ? (
        <Panel className="flex flex-col gap-3">
          <PanelTitle>Obstaw punkty (max {formatPoints(limit)})</PanelTitle>
          {final.locked[me.id] ? (
            <div className="text-center">
              <div className="text-display text-3xl text-gold">{formatPoints(myWager ?? 0)}</div>
              <p className="text-sm text-white/55">Zakład przyjęty. Czekaj na pytanie.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  value={wager}
                  onChange={(event) => setWager(event.target.value.replace(/[^0-9]/g, ''))}
                />
                <Button
                  variant="primary"
                  disabled={final.stage !== 'wagering'}
                  onClick={() => send({ type: 'finalWager', amount: Number(wager) || 0 })}
                >
                  Obstawiam
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {[0, 100, 250, 500, Math.round(limit / 2), limit].map((amount, index) => (
                  <Button
                    key={`${amount}-${index}`}
                    size="sm"
                    variant="secondary"
                    onClick={() => setWager(String(amount))}
                  >
                    {formatPoints(amount)}
                  </Button>
                ))}
              </div>
              {final.stage === 'category' ? (
                <p className="text-xs text-white/45">Prowadzący jeszcze nie otworzył obstawiania.</p>
              ) : null}
            </>
          )}
        </Panel>
      ) : null}

      {final.stage === 'question' || final.stage === 'answering' ? (
        <Panel className="flex flex-col gap-3">
          <PanelTitle>Twoja odpowiedź (obstawiono {formatPoints(myWager ?? 0)})</PanelTitle>
          <Input
            placeholder="Napisz odpowiedź…"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
          />
          <Button
            variant="primary"
            size="lg"
            onClick={() => send({ type: 'finalAnswer', text: answer })}
          >
            <Send className="size-4" /> {final.submitted[me.id] ? 'Popraw odpowiedź' : 'Wysyłam'}
          </Button>
          {final.submitted[me.id] ? (
            <p className="text-center text-sm text-mint">Odpowiedź zapisana.</p>
          ) : null}
        </Panel>
      ) : null}

      {final.stage === 'reveal' || final.stage === 'scored' ? (
        <Panel className="flex flex-col gap-2">
          <PanelTitle>Odpowiedzi na forum</PanelTitle>
          {state.players.map((player) => {
            const revealed = final.revealed.includes(player.id)
            const verdict = final.verdicts[player.id]
            return (
              <div
                key={player.id}
                className={cn(
                  'rounded-xl border px-3 py-2',
                  verdict === 'correct'
                    ? 'border-mint/60 bg-mint/10'
                    : verdict === 'wrong'
                      ? 'border-coral/60 bg-coral/10'
                      : 'border-stage-600',
                )}
              >
                <div className="flex items-center gap-2 text-sm">
                  <span>{player.avatar}</span>
                  <span className="flex-1 truncate">{player.name}</span>
                  <Badge tone="gold">{formatPoints(final.wagers[player.id] ?? 0)}</Badge>
                </div>
                <div className="mt-1">
                  {revealed ? `„${final.answers[player.id] || '—'}”` : 'odpowiedź zakryta'}
                </div>
              </div>
            )
          })}
          {final.answerText ? (
            <div className="rounded-xl border border-mint/60 bg-mint/10 p-3 text-center">
              <div className="text-xs text-mint uppercase">Poprawna odpowiedź</div>
              <div className="text-lg font-semibold">{final.answerText}</div>
              {final.answerMedia?.src ? (
                <MediaView media={final.answerMedia} className="mt-3" hideLabel />
              ) : null}
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  )
}
