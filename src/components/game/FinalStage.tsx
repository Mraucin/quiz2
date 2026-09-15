import { Check, Eye, Lock, Send, X } from 'lucide-react'
import { DrawingPad } from '@/components/game/DrawingPad'
import { MediaView } from '@/components/game/MediaView'
import { Button } from '@/components/ui/button'
import { Badge, Input, Panel, PanelTitle } from '@/components/ui/primitives'
import { secondsLeft, useTicker } from '@/hooks/useTicker'
import { maxWager } from '@/lib/engine'
import type { AdminAction, FinalQuestion, FinalStage as Stage, GameState } from '@/lib/types'
import { cn, formatPoints } from '@/lib/utils'
import { useState } from 'react'

const stageLabel: Record<Stage, string> = {
  category: 'Ogłoszenie kategorii',
  wagering: 'Obstawianie punktów',
  question: 'Pytanie odkryte',
  answering: 'Gracze piszą odpowiedzi',
  reveal: 'Publiczne odkrywanie odpowiedzi',
  scored: 'Rozliczone',
}

export function FinalStageView({
  state,
  question,
  skewMs = 0,
  showWagers,
}: {
  state: GameState
  question?: FinalQuestion | null
  skewMs?: number
  showWagers?: boolean
}) {
  const final = state.final
  useTicker(Boolean(final?.timerEndsAt && final.stage === 'answering'))
  if (!final) return null
  const remaining = final.stage === 'answering' ? secondsLeft(final.timerEndsAt, skewMs) : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Badge tone="violet" className="text-sm">
            Finał {final.index + 1}/{final.total}
          </Badge>
          <Badge>{stageLabel[final.stage]}</Badge>
        </div>
        {remaining !== null ? (
          <div className={cn('text-display text-4xl', remaining <= 10 ? 'text-coral' : 'text-gold')}>
            {remaining}s
          </div>
        ) : null}
      </div>

      <div className="text-center">
        <div className="text-xs tracking-[0.3em] text-white/45 uppercase">Kategoria</div>
        <div className="text-display text-4xl text-gold sm:text-6xl">{final.category}</div>
      </div>

      {final.prompt ? (
        <p className="animate-pop text-balance text-center text-2xl leading-snug font-semibold sm:text-4xl">
          {final.prompt}
        </p>
      ) : (
        <p className="text-center text-lg text-white/50">
          Obstawcie punkty, zanim zobaczycie pytanie.
        </p>
      )}

      {question?.media && final.prompt ? <MediaView media={question.media} /> : null}

      <div className="grid grid-cols-2 gap-2">
        {state.players.map((player) => {
          const wager = final.wagers[player.id]
          const verdict = final.verdicts[player.id]
          const revealed = final.revealed.includes(player.id)
          return (
            <div
              key={player.id}
              className={cn(
                'panel flex flex-col gap-1 px-4 py-3 transition',
                verdict === 'correct' && 'border-mint/70 bg-mint/10',
                verdict === 'wrong' && 'border-coral/70 bg-coral/10',
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{player.avatar}</span>
                <span className="flex-1 truncate font-semibold">{player.name}</span>
                {final.locked[player.id] ? (
                  <Badge tone="gold">
                    {showWagers || revealed || final.stage === 'reveal'
                      ? formatPoints(wager ?? 0)
                      : 'obstawił'}
                  </Badge>
                ) : (
                  <Badge>czeka</Badge>
                )}
                {final.submitted[player.id] ? (
                  <Badge tone="mint">
                    <Send className="size-3" /> gotowe
                  </Badge>
                ) : null}
              </div>
              {revealed ? (
                <div className="animate-pop">
                  <DrawingPad value={final.answers[player.id]} />
                </div>
              ) : (
                <div className="text-sm text-white/35">
                  <Lock className="mr-1 inline size-3" /> odpowiedź zakryta
                </div>
              )}
              {verdict ? (
                <div className={cn('text-sm font-semibold', verdict === 'correct' ? 'text-mint' : 'text-coral')}>
                  {verdict === 'correct' ? '+' : '−'}
                  {formatPoints(wager ?? 0)}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {final.answerText ? (
        <div className="animate-pop rounded-card border border-mint/60 bg-mint/10 p-4 text-center">
          <div className="text-xs tracking-[0.2em] text-mint uppercase">Poprawna odpowiedź</div>
          <div className="text-display text-3xl">{final.answerText}</div>
          {question?.answerMedia ? <MediaView media={question.answerMedia} className="mt-3" /> : null}
        </div>
      ) : null}
    </div>
  )
}

const nextStage: Record<Stage, Stage | null> = {
  category: 'wagering',
  wagering: 'question',
  question: 'answering',
  answering: 'reveal',
  reveal: 'scored',
  scored: null,
}

export function FinalControls({
  state,
  dispatch,
}: {
  state: GameState
  dispatch: (action: AdminAction) => void
}) {
  const final = state.final
  const [wagerDrafts, setWagerDrafts] = useState<Record<string, string>>({})
  if (!final) return null
  const forward = nextStage[final.stage]
  const allWagered = state.players.every((p) => final.locked[p.id])

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelTitle>Przebieg finału</PanelTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {forward ? (
            <Button variant="primary" onClick={() => dispatch({ type: 'finalStage', stage: forward })}>
              {forward === 'wagering'
                ? 'Otwórz obstawianie'
                : forward === 'question'
                  ? 'Pokaż pytanie'
                  : forward === 'answering'
                    ? 'Start odpowiedzi (timer)'
                    : forward === 'reveal'
                      ? 'Przejdź do odkrywania'
                      : 'Zakończ pytanie'}
            </Button>
          ) : null}
          <Button variant="outline" onClick={() => dispatch({ type: 'finalRevealAnswer' })}>
            <Eye className="size-4" /> Pokaż klucz
          </Button>
          <Button variant="secondary" onClick={() => dispatch({ type: 'finalNextQuestion' })}>
            Następne pytanie ({final.index + 1}/{final.total})
          </Button>
          <Button variant="ghost" onClick={() => dispatch({ type: 'showResults' })}>
            Zakończ grę
          </Button>
        </div>
        {!allWagered && final.stage === 'wagering' ? (
          <p className="mt-2 text-xs text-white/50">Nie wszyscy gracze obstawili.</p>
        ) : null}
      </Panel>

      <Panel>
        <PanelTitle>Odpowiedzi graczy</PanelTitle>
        <div className="mt-2 flex flex-col gap-2">
          {state.players.map((player) => {
            const wager = final.wagers[player.id] ?? 0
            const revealed = final.revealed.includes(player.id)
            const verdict = final.verdicts[player.id]
            const draft = wagerDrafts[player.id] ?? String(wager)
            return (
              <div key={player.id} className="rounded-xl border border-stage-600 p-2">
                <div className="flex items-center gap-2">
                  <span>{player.avatar}</span>
                  <span className="flex-1 truncate text-sm">{player.name}</span>
                  <Input
                    className="h-8 w-24 text-sm"
                    inputMode="numeric"
                    value={draft}
                    onChange={(event) =>
                      setWagerDrafts((prev) => ({ ...prev, [player.id]: event.target.value }))
                    }
                    onBlur={() =>
                      dispatch({
                        type: 'finalSetWager',
                        playerId: player.id,
                        amount: Number(draft) || 0,
                      })
                    }
                  />
                  <span className="text-xs text-white/40">max {formatPoints(maxWager(player))}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <DrawingPad value={final.answers[player.id]} className="h-16 w-40 flex-none" />
                  <Button
                    size="sm"
                    variant={revealed ? 'ghost' : 'outline'}
                    onClick={() => dispatch({ type: 'finalReveal', playerId: player.id })}
                  >
                    <Eye className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={verdict === 'correct' ? 'success' : 'secondary'}
                    onClick={() => dispatch({ type: 'finalJudge', playerId: player.id, correct: true })}
                  >
                    <Check className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant={verdict === 'wrong' ? 'danger' : 'secondary'}
                    onClick={() => dispatch({ type: 'finalJudge', playerId: player.id, correct: false })}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
