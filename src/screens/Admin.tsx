import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Flag,
  Globe,
  ListOrdered,
  Monitor,
  Pencil,
  RotateCcw,
  Trash2,
  TriangleAlert,
  UserPlus,
  Users,
} from 'lucide-react'
import { AdminPanel } from '@/components/game/AdminPanel'
import { BoardGrid } from '@/components/game/BoardGrid'
import { FinalControls, FinalStageView } from '@/components/game/FinalStage'
import { JoinPanel } from '@/components/game/JoinPanel'
import { PlayerStrip } from '@/components/game/PlayerStrip'
import { QuestionStage } from '@/components/game/QuestionStage'
import { Results } from '@/components/game/Results'
import { HostGate } from '@/components/HostGate'
import { Button } from '@/components/ui/button'
import { Badge, Input, Panel, PanelTitle } from '@/components/ui/primitives'
import { useHostGame } from '@/hooks/useHostGame'
import { AVATARS } from '@/lib/defaultPack'
import { boardRemaining, findQuestion, playerById } from '@/lib/engine'
import type { Pack } from '@/lib/types'
import { cn, formatPoints } from '@/lib/utils'

// Gates the real admin screen behind the pack's PIN (see HostGate) so `useHostGame` — which
// opens a PeerJS host connection and exposes the answer keys — never even mounts for someone
// who hasn't entered it.
export function AdminScreen({ pack, navigate }: { pack: Pack; navigate: (path: string) => void }) {
  return (
    <HostGate pack={pack} navigate={navigate}>
      <AdminScreenContent pack={pack} navigate={navigate} />
    </HostGate>
  )
}

function AdminScreenContent({ pack, navigate }: { pack: Pack; navigate: (path: string) => void }) {
  const { code, state, dispatch, dispatchAs, peerStatus, peerDetail, joinUrl } = useHostGame(pack)
  const [newPlayer, setNewPlayer] = useState('')
  const [presentation, setPresentation] = useState(false)

  const activeCategoryId = state?.active?.categoryId
  const activeQuestionId = state?.active?.questionId
  const activeQuestion = useMemo(() => {
    if (!activeCategoryId || !activeQuestionId) return null
    return findQuestion(pack, activeCategoryId, activeQuestionId)?.question ?? null
  }, [pack, activeCategoryId, activeQuestionId])

  if (!state) {
    return <div className="p-8 text-center text-white/60">Przygotowuję studio…</div>
  }

  const remaining = boardRemaining(state)
  const currentPlayer = playerById(state, state.currentPlayerId)

  const header = (
    <header className="flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Menu główne">
        <ArrowLeft className="size-4" />
      </Button>
      <div>
        <div className="text-display text-xl leading-none text-gold">Panel prowadzącego</div>
        <div className="text-xs text-white/50">{state.packName}</div>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Badge tone={peerStatus === 'online' ? 'mint' : peerStatus === 'error' ? 'coral' : 'neutral'}>
          <Globe className="size-3" />
          {peerStatus === 'online'
            ? 'Internet: gracze mogą dołączać z telefonów'
            : peerStatus === 'error'
              ? 'Brak brokera — tylko ta przeglądarka'
              : 'Łączę z brokerem…'}
        </Badge>
        <Badge tone="gold">Kod: {code}</Badge>
        <Button variant="ghost" size="sm" onClick={() => navigate('/editor')}>
          <Pencil className="size-4" /> Edytor
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPresentation((value) => !value)}
          title="Ukryj panel sterowania (tryb ekranu dla widowni)"
        >
          <Monitor className="size-4" /> {presentation ? 'Pokaż panel' : 'Tryb ekranu'}
        </Button>
      </div>
    </header>
  )

  if (state.phase === 'lobby') {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-6">
        {header}
        {peerStatus === 'error' ? (
          <Panel className="flex items-start gap-3 border-coral/50 bg-coral/10">
            <TriangleAlert className="mt-0.5 size-5 text-coral" />
            <div className="text-sm text-white/80">
              Nie udało się połączyć z publicznym brokerem PeerJS{peerDetail ? ` (${peerDetail})` : ''}.
              Gracze mogą nadal dołączyć w <strong>tej samej przeglądarce</strong> (nowa karta z
              linkiem obok) — albo dodaj ich jako graczy lokalnych i graj z jednego ekranu.
            </div>
          </Panel>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <JoinPanel code={code} joinUrl={joinUrl} />
          <div className="flex flex-col gap-4">
            <Panel>
              <div className="flex items-center justify-between gap-2">
                <PanelTitle>
                  <Users className="mr-1 inline size-4" /> Gracze w lobby ({state.players.length})
                </PanelTitle>
                <Button
                  variant="primary"
                  disabled={state.players.length === 0}
                  onClick={() => dispatch({ type: 'startGame' })}
                >
                  Rozpocznij grę
                </Button>
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {state.players.length === 0 ? (
                  <p className="text-sm text-white/50">
                    Gracze wchodzą na link, wpisują nick i wybierają ikonę. Możesz też dodać graczy
                    lokalnych (hot-seat), którymi sterujesz z tego panelu.
                  </p>
                ) : null}
                {state.players.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center gap-2 rounded-xl border border-stage-600 px-2 py-1.5"
                  >
                    <span className="text-xl">{player.avatar}</span>
                    <Input
                      className="h-8 flex-1"
                      value={player.name}
                      onChange={(event) =>
                        dispatch({ type: 'renamePlayer', playerId: player.id, name: event.target.value })
                      }
                    />
                    <Badge>{player.local ? 'hot-seat' : 'telefon'}</Badge>
                    <span className="text-xs text-white/40">#{index + 1}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => dispatch({ type: 'removePlayer', playerId: player.id })}
                    >
                      <Trash2 className="size-4 text-coral" />
                    </Button>
                  </div>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (!newPlayer.trim()) return
                  dispatch({
                    type: 'addLocalPlayer',
                    name: newPlayer.trim(),
                    avatar: AVATARS[state.players.length % AVATARS.length],
                  })
                  setNewPlayer('')
                }}
              >
                <Input
                  placeholder="Dodaj gracza lokalnego (hot-seat)"
                  value={newPlayer}
                  onChange={(event) => setNewPlayer(event.target.value)}
                />
                <Button type="submit" variant="secondary">
                  <UserPlus className="size-4" /> Dodaj
                </Button>
              </form>
            </Panel>
            <Panel>
              <PanelTitle>Zasady na skróty</PanelTitle>
              <ul className="mt-2 grid gap-1.5 text-sm text-white/70 sm:grid-cols-2">
                <li>• {state.board.length} kategorii × 6 pytań, wartości 100–600.</li>
                <li>• Wyliż chunka i Licytacje mają stałą wartość pytania, niezależną od pola.</li>
                <li>• Błędna odpowiedź: −wartość pytania.</li>
                <li>• Koło fortuny: pula z koła (bonus) + wartość pytania.</li>
                <li>• Wyliż chunka: 1. miejsce stała kwota, każde kolejne — mniej.</li>
                <li>• Licytacje: podbijasz liczbę odpowiedzi, potem je wymieniasz.</li>
                <li>• Finał: {pack.final.length} pytania otwarte z obstawianiem punktów.</li>
                <li>• Admin zawsze decyduje, czy odpowiedź jest poprawna.</li>
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    )
  }

  const sidebar = (
    <aside className="flex w-full flex-col gap-3 lg:w-[22rem]">
      {state.phase === 'question' ? (
        <AdminPanel
          state={state}
          question={activeQuestion}
          dispatch={dispatch}
          dispatchAs={dispatchAs}
        />
      ) : null}
      {state.phase === 'final' ? (
        <FinalControls key={state.final?.index} state={state} dispatch={dispatch} />
      ) : null}
      {state.phase === 'board' ? (
        <Panel>
          <PanelTitle>
            <ListOrdered className="mr-1 inline size-4" /> Kolejka
          </PanelTitle>
          <p className="mt-1 mb-2 text-sm text-white/60">
            Wybiera: {currentPlayer ? `${currentPlayer.avatar} ${currentPlayer.name}` : '—'}
          </p>
          <div className="flex flex-wrap gap-1">
            {state.players.map((player) => (
              <Button
                key={player.id}
                size="sm"
                variant={state.currentPlayerId === player.id ? 'primary' : 'secondary'}
                onClick={() => dispatch({ type: 'setCurrentPlayer', playerId: player.id })}
              >
                {player.avatar} {player.name}
              </Button>
            ))}
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelTitle>Korekty punktów</PanelTitle>
        <div className="mt-2 flex flex-col gap-2">
          {state.players.map((player) => (
            <div key={player.id} className="flex items-center gap-2 text-sm">
              <span>{player.avatar}</span>
              <span className="flex-1 truncate">{player.name}</span>
              <span className={cn('text-display w-16 text-right', player.score < 0 && 'text-coral')}>
                {formatPoints(player.score)}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dispatch({ type: 'adjustScore', playerId: player.id, delta: -100 })}
              >
                −100
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => dispatch({ type: 'adjustScore', playerId: player.id, delta: 100 })}
              >
                +100
              </Button>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Sterowanie grą</PanelTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant={remaining === 0 ? 'primary' : 'outline'}
            onClick={() => dispatch({ type: 'startFinal' })}
          >
            <Flag className="size-4" /> Runda finałowa
          </Button>
          {state.phase !== 'board' ? (
            <Button variant="ghost" onClick={() => dispatch({ type: 'backToBoard' })}>
              Wróć do planszy
            </Button>
          ) : null}
          <Button variant="ghost" onClick={() => dispatch({ type: 'showResults' })}>
            Wyniki
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Zrestartować grę? Punkty wrócą do zera.')) {
                dispatch({ type: 'resetGame' })
              }
            }}
          >
            <RotateCcw className="size-4" /> Reset
          </Button>
        </div>
        <p className="mt-2 text-xs text-white/45">Pozostało pytań na planszy: {remaining}</p>
      </Panel>

      <Panel className="max-h-64 overflow-y-auto">
        <PanelTitle>Przebieg</PanelTitle>
        <div className="mt-2 flex flex-col gap-1 text-xs">
          {state.log.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                entry.tone === 'good' ? 'text-mint' : entry.tone === 'bad' ? 'text-coral' : 'text-white/55',
              )}
            >
              {entry.text}
            </div>
          ))}
        </div>
      </Panel>
    </aside>
  )

  return (
    <div className="mx-auto flex max-w-[110rem] flex-col gap-4 p-3 sm:p-5">
      {header}
      <PlayerStrip
        state={state}
        highlightId={
          state.phase === 'board'
            ? state.currentPlayerId
            : (state.active?.lockedPlayerId ??
              state.active?.wheel?.turnPlayerId ??
              state.active?.list?.turnPlayerId ??
              state.active?.auction?.leaderId ??
              null)
        }
        onSelect={
          state.phase === 'board'
            ? (player) => dispatch({ type: 'setCurrentPlayer', playerId: player.id })
            : undefined
        }
      />
      <div className={cn('flex flex-col gap-4', !presentation && 'lg:flex-row')}>
        <main className="min-w-0 flex-1">
          <Panel className="min-h-[60vh] p-5">
            {state.phase === 'board' ? (
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <PanelTitle className="text-base">
                    Plansza — wybiera {currentPlayer ? currentPlayer.name : 'prowadzący'}
                  </PanelTitle>
                  <Badge>{remaining} pytań zostało</Badge>
                </div>
                {remaining === 0 ? (
                  <div className="animate-pop flex flex-wrap items-center gap-4 rounded-card border border-gold/60 bg-gold/10 p-4">
                    <Flag className="size-6 text-gold" />
                    <div className="flex-1">
                      <div className="text-display text-xl text-gold">Plansza wyczerpana</div>
                      <p className="text-sm text-white/65">
                        Czas na rundę finałową: {pack.final.length} pytań otwartych z obstawianiem.
                      </p>
                    </div>
                    <Button variant="primary" size="lg" onClick={() => dispatch({ type: 'startFinal' })}>
                      Zaczynamy finał
                    </Button>
                  </div>
                ) : null}
                <BoardGrid
                  state={state}
                  onPick={(categoryId, cell) =>
                    dispatch({ type: 'openQuestion', categoryId, questionId: cell.questionId })
                  }
                />
              </div>
            ) : null}
            {state.phase === 'question' ? (
              <QuestionStage state={state} question={activeQuestion} />
            ) : null}
            {state.phase === 'final' ? (
              <FinalStageView
                state={state}
                question={pack.final[state.final?.index ?? 0]}
                showWagers
              />
            ) : null}
            {state.phase === 'results' ? <Results state={state} /> : null}
          </Panel>
        </main>
        {presentation ? null : sidebar}
      </div>
    </div>
  )
}
