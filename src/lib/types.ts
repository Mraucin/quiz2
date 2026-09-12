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

export interface Category {
  id: string
  name: string
  /** 2 = kategoria warta podwójnie, 0.5 = warta o połowę mniej. Ignorowane, gdy ustawiono `fixedValue`. */
  multiplier: 0.5 | 1 | 2
  /** Gdy ustawione, każde pytanie w kategorii jest warte tyle samo (np. Wyliż chunka, Licytacje) — pomija rowValues×multiplier. */
  fixedValue?: number
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
  buzzersOpen: boolean
  buzzOrder: string[]
  lockedPlayerId: string | null
  wrongPlayers: string[]
  selections: Record<string, string>
  openAnswers: Record<string, string>
  answerRevealed: boolean
  answerText?: string
  answerMedia?: PublicMedia
  correctChoiceId?: string
  wheel?: WheelRuntime
  list?: ListRuntime
  auction?: AuctionRuntime
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

export type Phase = 'lobby' | 'board' | 'question' | 'final' | 'results'

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
  active: ActiveQuestion | null
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
  | { type: 'buzz' }
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
  | { type: 'openQuestion'; categoryId: string; questionId: string }
  | { type: 'setBuzzers'; open: boolean }
  | { type: 'lockPlayer'; playerId: string | null }
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
