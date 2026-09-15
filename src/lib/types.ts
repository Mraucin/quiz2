/** Shared data model for the quiz pack (content) and the live game state (runtime). */

export type MediaKind = 'image' | 'audio' | 'video'

export interface Media {
  kind: MediaKind
  /** Either an http(s) URL or a `data:` URL produced by the editor uploader. */
  src: string
  label?: string
}

export type QuestionKind = 'standard' | 'wheel' | 'list' | 'auction'

export interface Choice {
  id: string
  text: string
  media?: Media
}

export interface QuestionBase {
  id: string
  kind: QuestionKind
  prompt: string
  media?: Media
  /** The correct answer, shown to the admin and revealed on the board on demand. */
  answerText?: string
  answerMedia?: Media
  notes?: string
  /** Optional text read aloud by the browser speech synthesis (audio questions). */
  speak?: string
}

export interface StandardQuestion extends QuestionBase {
  kind: 'standard'
  /** Empty / missing -> open question without hints. */
  choices?: Choice[]
  correctChoiceId?: string
}

export interface WheelQuestion extends QuestionBase {
  kind: 'wheel'
  phrase: string
  /** "Kategoria hasła", e.g. Powiedzenie / Film / Rzecz. */
  phraseHint: string
}

export interface ListQuestion extends QuestionBase {
  kind: 'list'
  items: string[]
  /** Free mistakes per player before elimination (1 = "można pomylić się raz"). */
  freeMisses?: number
}

export interface AuctionQuestion extends QuestionBase {
  kind: 'auction'
  items: string[]
  timerSeconds?: number
}

export type Question = StandardQuestion | WheelQuestion | ListQuestion | AuctionQuestion

/**
 * A numeric-guess question used to pick who gets first designating rights at the start of the
 * game (and to break ties between round winners). Not part of the board — drawn from its own
 * pool so a tie-break round never repeats the same question (and thus the same guesses).
 */
export interface EstimationQuestion {
  id: string
  prompt: string
  media?: Media
  /** The number players are trying to guess closest to. */
  answer: number
  /** Optional unit shown after the answer, e.g. "km", "kg", "lat". */
  unit?: string
  notes?: string
}

export interface Category {
  id: string
  name: string
  /** 2 = kategoria warta podwójnie, 0.5 = warta o połowę mniej. Ignorowane, gdy ustawiono `fixedValue`. */
  multiplier: 0.5 | 1 | 2
  /** Gdy ustawione, każde pytanie w kategorii jest warte tyle samo (np. Wyliż chunka, Licytacje) — pomija rowValues×multiplier. */
  fixedValue?: number
  /** Która plansza pokazuje tę kategorię — Runda 1 czy Runda 2. Brak = Runda 1 (stare pakiety). */
  round?: 1 | 2
  questions: Question[]
}

export interface FinalQuestion {
  id: string
  category: string
  prompt: string
  media?: Media
  answerText: string
  answerMedia?: Media
}

export interface PackRules {
  /** Punkty, z którymi każdy gracz zaczyna grę (dołączenie do lobby, gracz lokalny, reset gry). */
  startingScore: number
  /** Base row values before the category multiplier. */
  rowValues: number[]
  /** Cost of a vowel in Koło fortuny. */
  vowelCost: number
  /** "Wyliż chunka" payout for 1st place; each next place gets `listPayoutStep` less (can go negative). */
  listBasePayout: number
  /** How many points less each next placement gets in "Wyliż chunka" (e.g. 600, 400, 200, 0, -200…). */
  listPayoutStep: number
  auctionSeconds: number
  finalAnswerSeconds: number
  /** How long an assigned player has to answer a standard question once the admin starts the timer. */
  answerTimerSeconds: number
  /** PIN wymagany, żeby wejść na /admin i /editor — chroni klucze odpowiedzi przed graczami. */
  hostPin: string
}

export interface Pack {
  id: string
  name: string
  description?: string
  updatedAt: number
  rules: PackRules
  categories: Category[]
  final: FinalQuestion[]
  /** Pool of numeric-guess questions for the estimation round(s) that open the game. */
  estimation: EstimationQuestion[]
}

/* ------------------------------------------------------------------ *
 * Runtime state — everything below is broadcast to every player, so it
 * must never contain unrevealed answers.
 * ------------------------------------------------------------------ */

export interface Player {
  id: string
  name: string
  avatar: string
  color: string
  score: number
  connected: boolean
  /**
   * Timestamp (ms) of when this player became continuously disconnected, or `null` while
   * connected. Lets time-limited turns (e.g. Koło fortuny) auto-skip someone who's been gone
   * a while instead of stalling the whole game on them.
   */
  disconnectedAt: number | null
  /** Hot-seat player added from the admin console (no device of their own). */
  local: boolean
}

export interface BoardCell {
  questionId: string
  value: number
  kind: QuestionKind
  used: boolean
}

export interface BoardCategory {
  id: string
  name: string
  multiplier: 0.5 | 1 | 2
  fixedValue?: number
  /** Runda planszy, do której należy ta kategoria (patrz `Category.round`). */
  round: 1 | 2
  cells: BoardCell[]
}

export interface PublicMedia {
  kind: MediaKind
  /** Only present for http(s) media; uploads stay on the host screen. */
  src?: string
  label?: string
}

export interface WheelSegment {
  label: string
  value: number
  bankrupt?: boolean
}

export interface WheelRuntime {
  hint: string
  /** One entry per character of the phrase; letters hidden until guessed. */
  masked: string[]
  guessed: string[]
  pool: number
  vowelCost: number
  spinValue: number | null
  lastSpin: { label: string; value: number; bankrupt?: boolean } | null
  spinning: boolean
  spinIndex: number
  spinNonce: number
  /**
   * Turn order for this question: the player who picked the category first, then everyone
   * else from the highest score down to the lowest (frozen at the moment the wheel opened).
   */
  order: string[]
  turnPlayerId: string | null
  solveAttempt: { playerId: string; text: string } | null
  message: string | null
}

export interface ListRuntime
{
  itemCount: number
  found: { text: string; playerId: string | null }[]
  lives: Record<string, number>
  eliminated: string[]
  /** Participants in playing order. */
  order: string[]
  turnPlayerId: string | null
  pool: number
  settled: boolean
  payouts: { playerId: string; place: number; delta: number }[]
}

export interface AuctionRuntime {
  stage: 'bidding' | 'listing' | 'judged'
  bid: number
  leaderId: string | null
  itemCount: number
  found: string[]
  timerSeconds: number
  timerEndsAt: number | null
  timerRunning: boolean
}

export type QuestionStage = 'reading' | 'open' | 'locked' | 'resolved'

/**
 * Who is designating/answering a standard question, and the takeover queue around them.
 * `lockedPlayerId` on the enclosing `ActiveQuestion` is repurposed under this flow to mean
 * "whoever currently holds the floor" — the assignee at first, then whichever queued taker
 * gets the floor next if the assignee whiffs.
 */
export interface StandardAssignment {
  /** Gets to pick the next category + assignee once this question resolves. */
  designatorId: string
  /** The player this question was originally assigned to. */
  assignedPlayerId: string
  timerSeconds: number
  /** Set once the admin clicks "start timer" for whoever currently holds the floor. */
  timerEndsAt: number | null
  /** Click-order queue of players waiting for a shot if the current holder fails. */
  takeoverQueue: string[]
  /** Everyone (assignee or a taker) who already had — and failed — their turn on this question. */
  attempted: string[]
}

export interface ActiveQuestion {
  categoryId: string
  questionId: string
  categoryName: string
  kind: QuestionKind
  value: number
  prompt: string
  media?: PublicMedia
  speak?: string
  choices?: { id: string; text: string; media?: PublicMedia }[]
  stage: QuestionStage
  lockedPlayerId: string | null
  wrongPlayers: string[]
  selections: Record<string, string>
  openAnswers: Record<string, string>
  answerRevealed: boolean
  answerText?: string
  answerMedia?: PublicMedia
  correctChoiceId?: string
  /** Only set for `kind: 'standard'` — see `StandardAssignment`. */
  assignment?: StandardAssignment
  wheel?: WheelRuntime
  list?: ListRuntime
  auction?: AuctionRuntime
}

/**
 * A running (or just-finished) estimation round. `correctAnswer`/`winnerIds` are only ever
 * added once the admin reveals — never present beforehand, since this whole object is
 * broadcast verbatim to every player.
 */
export interface EstimationRuntime {
  questionId: string
  prompt: string
  media?: PublicMedia
  unit?: string
  /** Everyone still competing this round — all players in round 1, only the tied leaders in a tie-break. */
  eligiblePlayerIds: string[]
  guesses: Record<string, number>
  revealed: boolean
  correctAnswer?: number
  /** More than one entry means a tie — another round follows with just these players. */
  winnerIds?: string[]
  /** Questions already used this game, so a tie-break round never repeats one. */
  usedQuestionIds: string[]
}

export type FinalStage = 'category' | 'wagering' | 'question' | 'answering' | 'reveal' | 'scored'

export interface FinalRuntime
{
  index: number
  total: number
  stage: FinalStage
  category: string
  prompt: string | null
  media?: PublicMedia
  answerText?: string
  answerMedia?: PublicMedia
  wagers: Record<string, number>
  locked: Record<string, boolean>
  answers: Record<string, string>
  submitted: Record<string, boolean>
  revealed: string[]
  verdicts: Record<string, 'correct' | 'wrong'>
  timerEndsAt: number | null
}

export type Phase = 'lobby' | 'estimation' | 'board' | 'question' | 'final' | 'results'

export interface LogEntry {
  id: string
  at: number
  text: string
  tone: 'info' | 'good' | 'bad'
}

export interface GameState {
  code: string
  packName: string
  phase: Phase
  players: Player[]
  turnOrder: string[]
  currentPlayerId: string | null
  board: BoardCategory[]
  /** Which board is currently in play — Runda 1 or Runda 2 (see `startRound2`). */
  round: 1 | 2
  active: ActiveQuestion | null
  /** Non-null while an estimation round is in progress (see `Phase = 'estimation'`). */
  estimation: EstimationRuntime | null
  /** Estimation question ids already used this game (both rounds), so Runda 2's opening estimation never repeats Runda 1's. */
  estimationUsedIds: string[]
  /** How many times a question has been taken over so far this game — capped at 4 (see `requestTakeover`). */
  takeoversUsed: number
  final: FinalRuntime | null
  log: LogEntry[]
  rules: PackRules
  startedAt: number | null
  version: number
  /** Host clock at broadcast time, used by clients to correct timer skew. */
  now: number
}

/* ------------------------------------------------------------------ *
 * Messages exchanged between admin (host) and players (clients)
 * ------------------------------------------------------------------ */

export type PlayerAction =
  | { type: 'pick'; categoryId: string; questionId: string }
  | { type: 'estimateGuess'; amount: number }
  | { type: 'requestTakeover' }
  | { type: 'choose'; choiceId: string }
  | { type: 'openAnswer'; text: string }
  | { type: 'wheelSpin' }
  | { type: 'wheelLetter'; letter: string }
  | { type: 'wheelBuyVowel'; letter: string }
  | { type: 'wheelSolve'; text: string }
  | { type: 'auctionBid' }
  | { type: 'finalWager'; amount: number }
  | { type: 'finalAnswer'; text: string }

export type AdminAction =
  | { type: 'addLocalPlayer'; name: string; avatar?: string }
  | { type: 'removePlayer'; playerId: string }
  | { type: 'renamePlayer'; playerId: string; name: string }
  | { type: 'startGame' }
  | { type: 'setCurrentPlayer'; playerId: string }
  | { type: 'estimateReveal' }
  | { type: 'estimateAdvance' }
  /** Board 1 (Runda 1) is fully used up — switch to board 2 and open a fresh estimation round to pick who designates first. */
  | { type: 'startRound2' }
  /** Manual override — lets the admin flip which board (Runda 1/2) is currently shown/pickable,
   * independent of `startRound2` (no estimation round, no exhaustion check). Only takes effect
   * while `phase === 'board'`, e.g. to go back and finish a leftover Runda 1 question, or to
   * peek/jump ahead into Runda 2. */
  | { type: 'setRound'; round: 1 | 2 }
  | { type: 'openQuestion'; categoryId: string; questionId: string; assignedPlayerId?: string }
  | { type: 'startAnswerTimer'; seconds?: number }
  | { type: 'judge'; playerId: string; correct: boolean }
  | { type: 'revealAnswer' }
  | { type: 'closeQuestion'; markUsed?: boolean }
  | { type: 'adjustScore'; playerId: string; delta: number }
  | { type: 'wheelSpin' }
  | { type: 'wheelLetter'; letter: string }
  | { type: 'wheelRevealAll' }
  | { type: 'wheelPassTurn' }
  | { type: 'wheelJudge'; correct: boolean }
  | { type: 'listToggleItem'; index: number; playerId?: string }
  | { type: 'listMiss'; playerId: string }
  | { type: 'listSetLives'; playerId: string; lives: number }
  | { type: 'listNextPlayer' }
  | { type: 'listSetTurn'; playerId: string }
  | { type: 'listSettle' }
  | { type: 'auctionStop' }
  | { type: 'auctionSetBid'; bid: number; leaderId?: string | null }
  | { type: 'auctionToggleItem'; index: number }
  | { type: 'auctionTimer'; running: boolean; reset?: boolean }
  | { type: 'auctionJudge'; correct: boolean }
  | { type: 'startFinal' }
  | { type: 'finalStage'; stage: FinalStage }
  | { type: 'finalLockWager'; playerId: string }
  | { type: 'finalSetWager'; playerId: string; amount: number }
  | { type: 'finalReveal'; playerId: string }
  | { type: 'finalRevealAnswer' }
  | { type: 'finalJudge'; playerId: string; correct: boolean }
  | { type: 'finalNextQuestion' }
  | { type: 'finalTimer'; running: boolean }
  | { type: 'showResults' }
  | { type: 'backToBoard' }
  | { type: 'resetGame' }

export type GameAction =
  | { source: 'admin'; action: AdminAction }
  | { source: 'player'; playerId: string; action: PlayerAction }

export type HostMessage =
  | { type: 'state'; state: GameState }
  | { type: 'welcome'; playerId: string; state: GameState }
  | { type: 'rejected'; reason: string }
  | { type: 'toast'; text: string }

export type ClientMessage =
  | { type: 'join'; name: string; avatar: string; resumeId?: string }
  | { type: 'action'; action: PlayerAction }
  | { type: 'ping' }
