import { AVATARS, PLAYER_COLORS, WHEEL_SEGMENTS } from './defaultPack'
import type {
  ActiveQuestion,
  BoardCategory,
  Category,
  GameAction,
  GameState,
  Media,
  Pack,
  Player,
  PublicMedia,
  Question,
} from './types'
import { approxDataUrlBytes, MAX_PLAYER_MEDIA_BYTES, randomId } from './utils'

export const VOWELS = 'AĄEĘIOÓUY'

export function isVowel(letter: string) {
  return VOWELS.includes(letter.toUpperCase())
}

export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/gi, 'l')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function cellValue(pack: Pack, category: Pick<Category, 'multiplier' | 'fixedValue'>, row: number) {
  if (category.fixedValue != null) return category.fixedValue
  const base = pack.rules.rowValues[row] ?? (row + 1) * 100
  return base * category.multiplier
}

/**
 * Remote (http/https) media always goes to phones. Local uploads (`data:` URLs) go too, as
 * long as they're under `MAX_PLAYER_MEDIA_BYTES` — bigger ones stay host-screen-only so they
 * don't get re-sent in full on every game-state broadcast to every connected phone.
 */
function toPublicMedia(media?: Media): PublicMedia | undefined {
  if (!media) return undefined
  const isRemote = /^https?:\/\//i.test(media.src)
  const fitsForPlayers = isRemote || approxDataUrlBytes(media.src) <= MAX_PLAYER_MEDIA_BYTES
  return { kind: media.kind, label: media.label, src: fitsForPlayers ? media.src : undefined }
}

export function buildBoard(pack: Pack): BoardCategory[] {
  return pack.categories.map((category) => ({
    id: category.id,
    name: category.name,
    multiplier: category.multiplier,
    fixedValue: category.fixedValue,
    cells: category.questions.map((question, row) => ({
      questionId: question.id,
      value: cellValue(pack, category, row),
      kind: question.kind,
      used: false,
    })),
  }))
}

export function createInitialState(pack: Pack, code: string): GameState {
  return {
    code,
    packName: pack.name,
    phase: 'lobby',
    players: [],
    turnOrder: [],
    currentPlayerId: null,
    board: buildBoard(pack),
    active: null,
    final: null,
    log: [],
    rules: pack.rules,
    startedAt: null,
    version: 1,
    now: Date.now(),
  }
}

/** Adds (or re-attaches) a player that joined from their own device. */
export function joinPlayer(
  prev: GameState,
  input: { playerId?: string; name: string; avatar: string },
): { state: GameState; playerId: string } {
  const state: GameState = structuredClone(prev)
  state.version = prev.version + 1
  const existing = input.playerId ? playerById(state, input.playerId) : null
  if (existing) {
    existing.connected = true
    existing.name = input.name || existing.name
    existing.avatar = input.avatar || existing.avatar
    if (!state.turnOrder.includes(existing.id)) state.turnOrder.push(existing.id)
    log(state, `${existing.avatar} ${existing.name} wraca do gry`)
    return { state, playerId: existing.id }
  }
  const id = randomId('p')
  const index = state.players.length
  state.players.push({
    id,
    name: input.name.slice(0, 24) || `Gracz ${index + 1}`,
    avatar: input.avatar || AVATARS[index % AVATARS.length],
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    score: 0,
    connected: true,
    local: false,
  })
  state.turnOrder.push(id)
  if (!state.currentPlayerId && state.phase !== 'lobby') state.currentPlayerId = id
  log(state, `${input.avatar} ${input.name} dołącza do gry`, 'good')
  return { state, playerId: id }
}

export function setConnected(prev: GameState, playerId: string, connected: boolean): GameState {
  const state: GameState = structuredClone(prev)
  state.version = prev.version + 1
  const player = playerById(state, playerId)
  if (player) player.connected = connected
  return state
}

export function findQuestion(pack: Pack, categoryId: string, questionId: string) {
  const category = pack.categories.find((c) => c.id === categoryId)
  const question = category?.questions.find((q) => q.id === questionId)
  if (!category || !question) return null
  const row = category.questions.indexOf(question)
  return { category, question, row, value: cellValue(pack, category, row) }
}

export function activeQuestionSource(pack: Pack, state: GameState): Question | null {
  if (!state.active) return null
  const found = findQuestion(pack, state.active.categoryId, state.active.questionId)
  return found?.question ?? null
}

export function boardRemaining(state: GameState) {
  return state.board.reduce((sum, cat) => sum + cat.cells.filter((c) => !c.used).length, 0)
}

export function playerById(state: GameState, id: string | null | undefined) {
  if (!id) return null
  return state.players.find((p) => p.id === id) ?? null
}

export function maxWager(player: Player) {
  return Math.max(1000, Math.max(0, player.score))
}

export function standings(state: GameState) {
  return [...state.players].sort((a, b) => b.score - a.score)
}

function log(state: GameState, text: string, tone: 'info' | 'good' | 'bad' = 'info') {
  state.log = [{ id: randomId('l'), at: Date.now(), text, tone }, ...state.log].slice(0, 60)
}

function eligibleTurnOrder(state: GameState) {
  return state.turnOrder.filter((id) => state.players.some((p) => p.id === id))
}

/** Moves control to the next player in the turn order. */
function advanceTurn(state: GameState, fromId?: string | null) {
  const order = eligibleTurnOrder(state)
  if (order.length === 0) {
    state.currentPlayerId = null
    return
  }
  const startIndex = Math.max(0, order.indexOf(fromId ?? state.currentPlayerId ?? order[0]))
  state.currentPlayerId = order[(startIndex + 1) % order.length]
}

function nextAliveInList(state: GameState, fromId: string | null) {
  const list = state.active?.list
  if (!list) return null
  const participants = list.order.length ? list.order : state.turnOrder
  const alive = participants.filter((id) => !list.eliminated.includes(id))
  if (alive.length === 0) return null
  const idx = fromId ? alive.indexOf(fromId) : -1
  return alive[(idx + 1) % alive.length]
}

function makeActive(pack: Pack, state: GameState, categoryId: string, questionId: string) {
  const found = findQuestion(pack, categoryId, questionId)
  if (!found) return null
  const { category, question, value } = found
  const active: ActiveQuestion = {
    categoryId,
    questionId,
    categoryName: category.name,
    kind: question.kind,
    value,
    prompt: question.prompt,
    media: toPublicMedia(question.media),
    speak: question.speak,
    stage: 'reading',
    // Since the admin (not the players) now opens the tile, everyone already sees the prompt
    // at the same time — no reason to make them wait for a separate "open buzzers" step.
    buzzersOpen: true,
    buzzOrder: [],
    lockedPlayerId: null,
    wrongPlayers: [],
    selections: {},
    openAnswers: {},
    answerRevealed: false,
  }

  if (question.kind === 'standard' && question.choices?.length) {
    active.choices = question.choices.map((choice) => ({
      id: choice.id,
      text: choice.text,
      media: toPublicMedia(choice.media),
    }))
  }

  if (question.kind === 'wheel') {
    const phrase = question.phrase.toUpperCase()
    const picker = state.currentPlayerId
    // Picker goes first (their pick, their spin); everyone else follows from the highest
    // score down to the lowest, frozen at the moment the wheel opens.
    const others = state.players
      .filter((p) => p.id !== picker)
      .sort((x, y) => y.score - x.score)
      .map((p) => p.id)
    const order = picker ? [picker, ...others] : others
    active.wheel = {
      hint: question.phraseHint,
      masked: phrase.split('').map((char) => (/[A-ZĄĆĘŁŃÓŚŹŻ0-9]/.test(char) ? '' : char)),
      guessed: [],
      pool: 0,
      vowelCost: pack.rules.vowelCost,
      spinValue: null,
      lastSpin: null,
      spinning: false,
      spinIndex: 0,
      spinNonce: 0,
      order,
      turnPlayerId: picker ?? order[0] ?? null,
      solveAttempt: null,
      message: 'Zakręć kołem, a potem podaj spółgłoskę.',
    }
  }

  if (question.kind === 'list') {
    const lives = (question.freeMisses ?? 1) + 1
    active.list = {
      itemCount: question.items.length,
      found: question.items.map(() => ({ text: '', playerId: null })),
      lives: Object.fromEntries(state.turnOrder.map((id) => [id, lives])),
      eliminated: [],
      order: [...state.turnOrder],
      turnPlayerId: state.currentPlayerId ?? state.turnOrder[0] ?? null,
      // Fixed prize for 1st place, independent of which board cell was picked.
      pool: pack.rules.listBasePayout,
      settled: false,
      payouts: [],
    }
  }

  if (question.kind === 'auction') {
    active.auction = {
      stage: 'bidding',
      bid: 0,
      leaderId: null,
      itemCount: question.items.length,
      found: [],
      timerSeconds: question.timerSeconds ?? pack.rules.auctionSeconds,
      timerEndsAt: null,
      timerRunning: false,
    }
  }

  return active
}

function revealAnswer(pack: Pack, state: GameState) {
  const active = state.active
  if (!active) return
  const question = activeQuestionSource(pack, state)
  if (!question) return
  active.answerRevealed = true
  active.answerText = question.answerText ?? (question.kind === 'wheel' ? question.phrase : '')
  active.answerMedia = toPublicMedia(question.answerMedia)
  if (question.kind === 'standard') active.correctChoiceId = question.correctChoiceId
  if (question.kind === 'wheel' && active.wheel) {
    active.wheel.masked = question.phrase
      .toUpperCase()
      .split('')
      .map((char) => char)
  }
}

function scoreCorrect(state: GameState, playerId: string, amount: number) {
  const player = playerById(state, playerId)
  if (!player) return
  player.score += amount
  log(state, `${player.avatar} ${player.name} +${amount}`, 'good')
}

function scoreWrong(state: GameState, playerId: string, amount: number) {
  const player = playerById(state, playerId)
  if (!player) return
  player.score -= amount
  log(state, `${player.avatar} ${player.name} -${amount}`, 'bad')
}

function settleList(state: GameState) {
  const list = state.active?.list
  if (!list || list.settled) return
  const alive = state.turnOrder.filter((id) => !list.eliminated.includes(id))
  const ranked = [
    ...alive.sort((a, b) => (list.lives[b] ?? 0) - (list.lives[a] ?? 0)),
    ...[...list.eliminated].reverse(),
  ]
  const { listBasePayout, listPayoutStep } = state.rules
  list.payouts = ranked.map((playerId, index) => {
    // 1st place gets listBasePayout, each next place listPayoutStep less — uncapped, so it can go negative.
    const delta = listBasePayout - listPayoutStep * index
    const player = playerById(state, playerId)
    if (player) player.score += delta
    return { playerId, place: index + 1, delta }
  })
  list.settled = true
  list.turnPlayerId = null
  if (state.active) state.active.stage = 'resolved'
  const winner = playerById(state, ranked[0])
  if (winner) log(state, `${winner.avatar} ${winner.name} wygrywa ${listBasePayout}`, 'good')
}

function currentFinalQuestion(pack: Pack, state: GameState) {
  if (!state.final) return null
  return pack.final[state.final.index] ?? null
}

function startFinalQuestion(pack: Pack, state: GameState, index: number) {
  const question = pack.final[index]
  if (!question) {
    state.phase = 'results'
    return
  }
  state.final = {
    index,
    total: pack.final.length,
    stage: 'category',
    category: question.category,
    prompt: null,
    wagers: {},
    locked: {},
    answers: {},
    submitted: {},
    revealed: [],
    verdicts: {},
    timerEndsAt: null,
  }
  state.phase = 'final'
}

export function applyAction(pack: Pack, prev: GameState, event: GameAction): GameState {
  const state: GameState = structuredClone(prev)
  state.version = prev.version + 1
  const active = () => state.active

  if (event.source === 'admin') {
    const action = event.action
    switch (action.type) {
      case 'addLocalPlayer': {
        const id = randomId('p')
        state.players.push({
          id,
          name: action.name.trim() || `Gracz ${state.players.length + 1}`,
          avatar: action.avatar ?? AVATARS[state.players.length % AVATARS.length],
          color: PLAYER_COLORS[state.players.length % PLAYER_COLORS.length],
          score: 0,
          connected: true,
          local: true,
        })
        state.turnOrder.push(id)
        break
      }
      case 'removePlayer': {
        state.players = state.players.filter((p) => p.id !== action.playerId)
        state.turnOrder = state.turnOrder.filter((id) => id !== action.playerId)
        if (state.currentPlayerId === action.playerId) advanceTurn(state, action.playerId)
        break
      }
      case 'renamePlayer': {
        const player = playerById(state, action.playerId)
        if (player) player.name = action.name
        break
      }
      case 'startGame': {
        if (state.players.length === 0) break
        state.phase = 'board'
        state.startedAt = Date.now()
        state.turnOrder = state.players.map((p) => p.id)
        state.currentPlayerId = state.turnOrder[0]
        state.board = buildBoard(pack)
        log(state, 'Gra rozpoczęta!', 'good')
        break
      }
      case 'setCurrentPlayer': {
        state.currentPlayerId = action.playerId
        break
      }
      case 'openQuestion': {
        const next = makeActive(pack, state, action.categoryId, action.questionId)
        if (!next) break
        state.active = next
        state.phase = 'question'
        log(state, `${next.categoryName} za ${next.value}`)
        break
      }
      case 'setBuzzers': {
        const a = active()
        if (!a) break
        a.buzzersOpen = action.open
        if (action.open && a.stage === 'reading') a.stage = 'open'
        break
      }
      case 'lockPlayer': {
        const a = active()
        if (!a) break
        a.lockedPlayerId = action.playerId
        a.stage = action.playerId ? 'locked' : 'open'
        a.buzzersOpen = !action.playerId
        break
      }
      case 'judge': {
        const a = active()
        if (!a) break
        if (action.correct) {
          scoreCorrect(state, action.playerId, a.value)
          state.currentPlayerId = action.playerId
          a.stage = 'resolved'
          a.buzzersOpen = false
          revealAnswer(pack, state)
        } else {
          scoreWrong(state, action.playerId, a.value)
          if (!a.wrongPlayers.includes(action.playerId)) a.wrongPlayers.push(action.playerId)
          a.lockedPlayerId = null
          a.stage = 'open'
          a.buzzersOpen = true
        }
        break
      }
      case 'revealAnswer': {
        revealAnswer(pack, state)
        break
      }
      case 'closeQuestion': {
        const a = active()
        if (a) {
          const resolvedCorrect = a.stage === 'resolved'
          if (action.markUsed !== false) {
            const category = state.board.find((c) => c.id === a.categoryId)
            const cell = category?.cells.find((c) => c.questionId === a.questionId)
            if (cell) cell.used = true
          }
          if (!resolvedCorrect) advanceTurn(state)
        }
        state.active = null
        state.phase = 'board'
        break
      }
      case 'adjustScore': {
        const player = playerById(state, action.playerId)
        if (player) {
          player.score += action.delta
          log(
            state,
            `Korekta: ${player.name} ${action.delta > 0 ? '+' : ''}${action.delta}`,
            action.delta >= 0 ? 'good' : 'bad',
          )
        }
        break
      }
      case 'wheelSpin': {
        const wheel = active()?.wheel
        if (!wheel || wheel.spinValue !== null) break
        const index = Math.floor(Math.random() * WHEEL_SEGMENTS.length)
        const segment = WHEEL_SEGMENTS[index]
        wheel.spinIndex = index
        wheel.spinNonce += 1
        wheel.lastSpin = { label: segment.label, value: segment.value, bankrupt: segment.bankrupt }
        if (segment.bankrupt) {
          wheel.pool = 0
          wheel.spinValue = null
          wheel.message = 'BANKRUT! Pula przepada, kolejka przechodzi dalej.'
          wheel.turnPlayerId = nextWheelPlayer(state, wheel.turnPlayerId)
        } else {
          wheel.spinValue = segment.value
          wheel.message = `Koło: ${segment.label}. Podaj spółgłoskę!`
        }
        break
      }
      case 'wheelLetter': {
        applyWheelLetter(pack, state, action.letter, wheelTurnPlayer(state))
        break
      }
      case 'wheelRevealAll': {
        revealAnswer(pack, state)
        const a = active()
        if (a) a.stage = 'resolved'
        break
      }
      case 'wheelPassTurn': {
        const wheel = active()?.wheel
        if (!wheel) break
        wheel.spinValue = null
        wheel.turnPlayerId = nextWheelPlayer(state, wheel.turnPlayerId)
        wheel.message = 'Kolejka przechodzi dalej.'
        break
      }
      case 'wheelJudge': {
        const a = active()
        const wheel = a?.wheel
        if (!a || !wheel) break
        const attempt = wheel.solveAttempt
        const playerId = attempt?.playerId ?? wheel.turnPlayerId
        if (!playerId) break
        if (action.correct) {
          scoreCorrect(state, playerId, a.value + wheel.pool)
          state.currentPlayerId = playerId
          a.stage = 'resolved'
          revealAnswer(pack, state)
          wheel.message = 'Hasło rozwiązane!'
        } else {
          scoreWrong(state, playerId, a.value)
          if (!a.wrongPlayers.includes(playerId)) a.wrongPlayers.push(playerId)
          wheel.spinValue = null
          wheel.solveAttempt = null
          wheel.turnPlayerId = nextWheelPlayer(state, playerId)
          wheel.message = 'Błędne hasło. Kolejka przechodzi dalej.'
        }
        break
      }
      case 'listToggleItem': {
        const a = active()
        const list = a?.list
        const question = activeQuestionSource(pack, state)
        if (!a || !list || question?.kind !== 'list') break
        const entry = list.found[action.index]
        if (!entry) break
        if (entry.playerId) {
          entry.playerId = null
          entry.text = ''
        } else {
          const playerId = action.playerId ?? list.turnPlayerId
          entry.playerId = playerId ?? null
          entry.text = question.items[action.index] ?? ''
          list.turnPlayerId = nextAliveInList(state, playerId ?? null)
        }
        break
      }
      case 'listMiss': {
        const list = active()?.list
        if (!list) break
        const lives = (list.lives[action.playerId] ?? 1) - 1
        list.lives[action.playerId] = Math.max(0, lives)
        const player = playerById(state, action.playerId)
        if (lives <= 0 && !list.eliminated.includes(action.playerId)) {
          list.eliminated.push(action.playerId)
          if (player) log(state, `${player.avatar} ${player.name} odpada z konkurencji`, 'bad')
        } else if (player) {
          log(state, `${player.avatar} ${player.name} — pomyłka (życia: ${Math.max(0, lives)})`, 'bad')
        }
        list.turnPlayerId = nextAliveInList(state, action.playerId)
        const aliveCount = state.turnOrder.filter((id) => !list.eliminated.includes(id)).length
        if (aliveCount <= 1) settleList(state)
        break
      }
      case 'listSetLives': {
        const list = active()?.list
        if (!list) break
        list.lives[action.playerId] = Math.max(0, action.lives)
        if (action.lives > 0) {
          list.eliminated = list.eliminated.filter((id) => id !== action.playerId)
        } else if (!list.eliminated.includes(action.playerId)) {
          list.eliminated.push(action.playerId)
        }
        break
      }
      case 'listNextPlayer': {
        const list = active()?.list
        if (!list) break
        list.turnPlayerId = nextAliveInList(state, list.turnPlayerId)
        break
      }
      case 'listSetTurn': {
        const list = active()?.list
        if (list) list.turnPlayerId = action.playerId
        break
      }
      case 'listSettle': {
        settleList(state)
        break
      }
      case 'auctionStop': {
        const auction = active()?.auction
        if (!auction) break
        auction.stage = 'listing'
        auction.timerEndsAt = Date.now() + auction.timerSeconds * 1000
        auction.timerRunning = true
        const leader = playerById(state, auction.leaderId)
        if (leader) log(state, `${leader.name} wymienia ${auction.bid} odpowiedzi`)
        break
      }
      case 'auctionSetBid': {
        const auction = active()?.auction
        if (!auction) break
        auction.bid = Math.max(0, action.bid)
        if (action.leaderId !== undefined) auction.leaderId = action.leaderId
        break
      }
      case 'auctionToggleItem': {
        const auction = active()?.auction
        const question = activeQuestionSource(pack, state)
        if (!auction || question?.kind !== 'auction') break
        const text = question.items[action.index]
        if (!text) break
        auction.found = auction.found.includes(text)
          ? auction.found.filter((item) => item !== text)
          : [...auction.found, text]
        break
      }
      case 'auctionTimer': {
        const auction = active()?.auction
        if (!auction) break
        auction.timerRunning = action.running
        if (action.reset) auction.timerEndsAt = Date.now() + auction.timerSeconds * 1000
        else if (action.running && !auction.timerEndsAt)
          auction.timerEndsAt = Date.now() + auction.timerSeconds * 1000
        break
      }
      case 'auctionJudge': {
        const a = active()
        const auction = a?.auction
        if (!a || !auction || !auction.leaderId) break
        auction.stage = 'judged'
        auction.timerRunning = false
        if (action.correct) {
          scoreCorrect(state, auction.leaderId, a.value)
          state.currentPlayerId = auction.leaderId
          a.stage = 'resolved'
        } else {
          scoreWrong(state, auction.leaderId, a.value)
          a.stage = 'resolved'
        }
        revealAnswer(pack, state)
        break
      }
      case 'startFinal': {
        state.active = null
        startFinalQuestion(pack, state, 0)
        log(state, 'Runda finałowa!', 'good')
        break
      }
      case 'finalStage': {
        if (!state.final) break
        state.final.stage = action.stage
        const question = currentFinalQuestion(pack, state)
        if (action.stage === 'question' || action.stage === 'answering') {
          state.final.prompt = question?.prompt ?? null
          state.final.media = toPublicMedia(question?.media)
        }
        if (action.stage === 'answering') {
          state.final.timerEndsAt = Date.now() + pack.rules.finalAnswerSeconds * 1000
        }
        break
      }
      case 'finalLockWager': {
        if (!state.final) break
        state.final.locked[action.playerId] = true
        break
      }
      case 'finalSetWager': {
        if (!state.final) break
        const player = playerById(state, action.playerId)
        if (!player) break
        state.final.wagers[action.playerId] = Math.min(
          Math.max(0, Math.round(action.amount)),
          maxWager(player),
        )
        state.final.locked[action.playerId] = true
        break
      }
      case 'finalReveal': {
        if (!state.final) break
        if (!state.final.revealed.includes(action.playerId)) {
          state.final.revealed.push(action.playerId)
        }
        break
      }
      case 'finalRevealAnswer': {
        const question = currentFinalQuestion(pack, state)
        if (!state.final || !question) break
        state.final.answerText = question.answerText
        state.final.answerMedia = toPublicMedia(question.answerMedia)
        break
      }
      case 'finalJudge': {
        if (!state.final) break
        const player = playerById(state, action.playerId)
        if (!player) break
        const wager = state.final.wagers[action.playerId] ?? 0
        const previous = state.final.verdicts[action.playerId]
        if (previous === 'correct') player.score -= wager
        if (previous === 'wrong') player.score += wager
        state.final.verdicts[action.playerId] = action.correct ? 'correct' : 'wrong'
        player.score += action.correct ? wager : -wager
        if (!state.final.revealed.includes(action.playerId)) {
          state.final.revealed.push(action.playerId)
        }
        log(
          state,
          `${player.avatar} ${player.name} ${action.correct ? '+' : '-'}${wager} (finał)`,
          action.correct ? 'good' : 'bad',
        )
        break
      }
      case 'finalNextQuestion': {
        if (!state.final) break
        const next = state.final.index + 1
        if (next >= pack.final.length) {
          state.phase = 'results'
          state.final.stage = 'scored'
        } else {
          startFinalQuestion(pack, state, next)
        }
        break
      }
      case 'finalTimer': {
        if (!state.final) break
        state.final.timerEndsAt = action.running
          ? Date.now() + pack.rules.finalAnswerSeconds * 1000
          : null
        break
      }
      case 'showResults': {
        state.phase = 'results'
        break
      }
      case 'backToBoard': {
        state.phase = 'board'
        state.active = null
        break
      }
      case 'resetGame': {
        const players = state.players.map((p) => ({ ...p, score: 0 }))
        const fresh = createInitialState(pack, state.code)
        fresh.players = players
        fresh.turnOrder = players.map((p) => p.id)
        fresh.version = state.version + 1
        return fresh
      }
    }
    return state
  }

  /* ----------------------------- player actions ----------------------------- */
  const playerId = event.playerId
  const player = playerById(state, playerId)
  if (!player) return prev
  const action = event.action
  const a = state.active

  switch (action.type) {
    case 'pick': {
      // Board picking is admin-only — the host opens questions from `/admin` (action
      // `openQuestion`) after the current player calls out their choice. Player devices
      // can no longer open a question themselves, whatever their turn.
      return prev
    }
    case 'buzz': {
      if (!a || !a.buzzersOpen) return prev
      if (a.wrongPlayers.includes(playerId)) return prev
      if (!a.buzzOrder.includes(playerId)) a.buzzOrder.push(playerId)
      if (!a.lockedPlayerId) {
        a.lockedPlayerId = playerId
        a.buzzersOpen = false
        a.stage = 'locked'
        log(state, `${player.avatar} ${player.name} zgłasza się!`)
      }
      break
    }
    case 'choose': {
      if (!a) return prev
      if (a.lockedPlayerId && a.lockedPlayerId !== playerId) return prev
      a.selections[playerId] = action.choiceId
      break
    }
    case 'openAnswer': {
      if (!a) return prev
      if (a.lockedPlayerId && a.lockedPlayerId !== playerId) return prev
      a.openAnswers[playerId] = action.text.slice(0, 240)
      break
    }
    case 'wheelSpin': {
      const wheel = a?.wheel
      if (!wheel || wheel.turnPlayerId !== playerId) return prev
      return applyAction(pack, prev, { source: 'admin', action: { type: 'wheelSpin' } })
    }
    case 'wheelLetter': {
      const wheel = a?.wheel
      if (!wheel || wheel.turnPlayerId !== playerId) return prev
      applyWheelLetter(pack, state, action.letter, playerId)
      break
    }
    case 'wheelBuyVowel': {
      const wheel = a?.wheel
      if (!wheel || wheel.turnPlayerId !== playerId) return prev
      if (!isVowel(action.letter)) return prev
      if (player.score < wheel.vowelCost) {
        wheel.message = 'Za mało punktów na samogłoskę.'
        break
      }
      player.score -= wheel.vowelCost
      applyWheelLetter(pack, state, action.letter, playerId, true)
      break
    }
    case 'wheelSolve': {
      const wheel = a?.wheel
      // Only the player whose turn it is to spin/guess may attempt to solve — everyone else
      // waits their turn. (The admin can still call this on behalf of the turn player, e.g.
      // for a hot-seat player answering out loud — see AdminPanel's wheel controls.)
      if (!wheel || wheel.turnPlayerId !== playerId) return prev
      wheel.solveAttempt = { playerId, text: action.text.slice(0, 200) }
      wheel.message = `${player.name} rozwiązuje hasło!`
      break
    }
    case 'auctionBid': {
      const auction = a?.auction
      if (!auction || auction.stage !== 'bidding') return prev
      if (auction.leaderId === playerId) return prev
      auction.bid += 1
      auction.leaderId = playerId
      break
    }
    case 'finalWager': {
      if (!state.final || state.final.stage !== 'wagering') return prev
      state.final.wagers[playerId] = Math.min(
        Math.max(0, Math.round(action.amount)),
        maxWager(player),
      )
      state.final.locked[playerId] = true
      break
    }
    case 'finalAnswer': {
      if (!state.final) return prev
      if (state.final.stage !== 'answering' && state.final.stage !== 'question') return prev
      state.final.answers[playerId] = action.text.slice(0, 400)
      state.final.submitted[playerId] = true
      break
    }
  }
  return state
}

function wheelTurnPlayer(state: GameState) {
  return state.active?.wheel?.turnPlayerId ?? null
}

function nextWheelPlayer(state: GameState, fromId: string | null) {
  // Cycle through the order frozen when the wheel opened (picker, then highest score down
  // to lowest) rather than the generic board turn order.
  const base = state.active?.wheel?.order ?? state.turnOrder
  const order = base.filter((id) => playerById(state, id))
  const pool = order.length ? order : base
  if (pool.length === 0) return null
  const index = fromId ? pool.indexOf(fromId) : -1
  return pool[(index + 1) % pool.length]
}

function applyWheelLetter(
  pack: Pack,
  state: GameState,
  rawLetter: string,
  playerId: string | null,
  bought = false,
) {
  const a = state.active
  const wheel = a?.wheel
  const question = activeQuestionSource(pack, state)
  if (!a || !wheel || question?.kind !== 'wheel') return
  const letter = rawLetter.toUpperCase().slice(0, 1)
  if (!letter || wheel.guessed.includes(letter)) return
  if (!bought && isVowel(letter)) {
    wheel.message = 'Samogłoski trzeba kupić!'
    return
  }
  if (!bought && wheel.spinValue === null) {
    wheel.message = 'Najpierw zakręć kołem.'
    return
  }
  const phrase = question.phrase.toUpperCase()
  wheel.guessed.push(letter)
  let hits = 0
  phrase.split('').forEach((char, index) => {
    if (char === letter) {
      wheel.masked[index] = char
      hits += 1
    }
  })
  const player = playerById(state, playerId)
  if (hits > 0) {
    if (!bought && wheel.spinValue) {
      wheel.pool += wheel.spinValue * hits
      wheel.message = `Litera ${letter} — ${hits}× (+${wheel.spinValue * hits} do puli). Kręć dalej!`
    } else {
      wheel.message = `Litera ${letter} — ${hits}×.`
    }
    wheel.spinValue = null
    if (!wheel.masked.includes('')) {
      wheel.message = 'Całe hasło odkryte — podaj rozwiązanie!'
    }
  } else {
    wheel.spinValue = null
    wheel.message = `Nie ma litery ${letter}. Kolejka przechodzi dalej.`
    wheel.turnPlayerId = nextWheelPlayer(state, playerId ?? wheel.turnPlayerId)
  }
  if (player && hits > 0) log(state, `${player.name}: litera ${letter} ×${hits}`, 'good')
}
