import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PACK, WHEEL_SEGMENTS } from './defaultPack'
import { applyAction, createInitialState, hasRound2, joinPlayer, setConnected } from './engine'
import type { AdminAction, GameState, Pack, PlayerAction, StandardQuestion } from './types'
import { MAX_PLAYER_MEDIA_BYTES } from './utils'

const pack: Pack = structuredClone(DEFAULT_PACK)
// Testy poniżej liczą dokładne delty punktowe (np. "+300", "wynik to 0") niezależnie od
// realnego punktu startowego domyślnego pakietu (2000 — patrz opis "punkty startowe" niżej,
// gdzie to konkretnie jest testowane z nieskorygowanym DEFAULT_PACK).
pack.rules.startingScore = 0

const categoryByName = (name: string) => {
  const category = pack.categories.find((item) => item.name === name)
  if (!category) throw new Error(`missing category ${name}`)
  return category
}

function admin(state: GameState, action: AdminAction) {
  return applyAction(pack, state, { source: 'admin', action })
}

function asPlayer(state: GameState, playerId: string, action: PlayerAction) {
  return applyAction(pack, state, { source: 'player', playerId, action })
}

function lobbyWithPlayers(names: string[]) {
  let state = createInitialState(pack, 'TEST1')
  const ids: string[] = []
  names.forEach((name) => {
    const result = joinPlayer(state, { name, avatar: '🦊' })
    state = result.state
    ids.push(result.playerId)
  })
  return { state, ids }
}

function startedGame(names = ['Ala', 'Bolek', 'Cezary']) {
  const { state: lobby, ids } = lobbyWithPlayers(names)
  let state = admin(lobby, { type: 'startGame' })
  // Deterministically resolve the opening estimation round so ids[0] always wins outright (no
  // tie) and lands on the board holding first picking rights — this is what all the pre-existing
  // board/question tests below are written against.
  if (state.phase === 'estimation' && state.estimation) {
    const correct = pack.estimation.find((q) => q.id === state.estimation?.questionId)?.answer ?? 0
    ids.forEach((id, index) => {
      state = asPlayer(state, id, { type: 'estimateGuess', amount: correct + index })
    })
    state = admin(state, { type: 'estimateReveal' })
    state = admin(state, { type: 'estimateAdvance' })
  }
  return { state, ids }
}

function openCell(state: GameState, categoryName: string, row: number) {
  const category = categoryByName(categoryName)
  return admin(state, {
    type: 'openQuestion',
    categoryId: category.id,
    questionId: category.questions[row].id,
  })
}

describe('lobby i start', () => {
  it('dodaje graczy i ustawia kolejkę', () => {
    const { state, ids } = startedGame()
    expect(state.phase).toBe('board')
    expect(state.players).toHaveLength(3)
    expect(state.currentPlayerId).toBe(ids[0])
    expect(state.board).toHaveLength(pack.categories.length)
    expect(state.board[0].cells).toHaveLength(6)
  })

  it('liczy podwójne wartości w kategoriach z mnożnikiem', () => {
    const { state } = startedGame()
    const wheel = state.board.find((category) => category.name === 'Koło fortuny')
    expect(wheel?.cells.map((cell) => cell.value)).toEqual([200, 400, 600, 800, 1000, 1200])
    const normal = state.board.find((category) => category.name === 'Piłkarze nieznani')
    expect(normal?.cells.map((cell) => cell.value)).toEqual([100, 200, 300, 400, 500, 600])
  })

  it('kategorie ze stałą wartością ignorują mnożnik i rowValues', () => {
    const { state } = startedGame()
    const list = state.board.find((category) => category.name === 'Wyliż chunka')
    expect(list?.cells.map((cell) => cell.value)).toEqual([600, 600, 600, 600, 600, 600])
    const auction = state.board.find((category) => category.name === 'Licytacje')
    expect(auction?.cells.map((cell) => cell.value)).toEqual([300, 300, 300, 300, 300, 300])
  })
})

describe('runda oszacowania', () => {
  it('startGame otwiera rundę oszacowania zamiast od razu planszy', () => {
    const { state: lobby } = lobbyWithPlayers(['Ala', 'Bolek', 'Cezary'])
    const started = admin(lobby, { type: 'startGame' })
    expect(started.phase).toBe('estimation')
    expect(started.estimation?.eligiblePlayerIds).toHaveLength(3)
  })

  it('wygrywa gracz z odpowiedzią najbliższą prawdy i to on wyznacza pierwsze pytanie', () => {
    const { state: lobby, ids } = lobbyWithPlayers(['Ala', 'Bolek', 'Cezary'])
    let state = admin(lobby, { type: 'startGame' })
    const correct = pack.estimation.find((q) => q.id === state.estimation?.questionId)!.answer
    state = asPlayer(state, ids[0], { type: 'estimateGuess', amount: correct + 10 })
    state = asPlayer(state, ids[1], { type: 'estimateGuess', amount: correct + 1 })
    state = asPlayer(state, ids[2], { type: 'estimateGuess', amount: correct + 5 })
    state = admin(state, { type: 'estimateReveal' })
    expect(state.estimation?.winnerIds).toEqual([ids[1]])
    state = admin(state, { type: 'estimateAdvance' })
    expect(state.phase).toBe('board')
    expect(state.currentPlayerId).toBe(ids[1])
  })

  it('remis uruchamia dogrywkę tylko dla remisujących, z nowym pytaniem', () => {
    const { state: lobby, ids } = lobbyWithPlayers(['Ala', 'Bolek', 'Cezary'])
    let state = admin(lobby, { type: 'startGame' })
    const firstQuestionId = state.estimation?.questionId
    const correct = pack.estimation.find((q) => q.id === firstQuestionId)!.answer
    state = asPlayer(state, ids[0], { type: 'estimateGuess', amount: correct + 1 })
    state = asPlayer(state, ids[1], { type: 'estimateGuess', amount: correct + 1 })
    state = asPlayer(state, ids[2], { type: 'estimateGuess', amount: correct + 20 })
    state = admin(state, { type: 'estimateReveal' })
    expect([...(state.estimation?.winnerIds ?? [])].sort()).toEqual([ids[0], ids[1]].sort())
    state = admin(state, { type: 'estimateAdvance' })
    expect(state.phase).toBe('estimation')
    expect([...(state.estimation?.eligiblePlayerIds ?? [])].sort()).toEqual([ids[0], ids[1]].sort())
    expect(state.estimation?.revealed).toBe(false)
  })
})

describe('pytania zwykłe', () => {
  it('otwarcie pytania przypisuje je bieżącemu graczowi (faza czytania, bez zablokowanego odpowiadającego)', () => {
    const { state: started, ids } = startedGame()
    const state = openCell(started, 'Piłkarze nieznani', 2)
    expect(state.active?.stage).toBe('reading')
    expect(state.active?.assignment?.designatorId).toBe(ids[0])
    expect(state.active?.assignment?.assignedPlayerId).toBe(ids[0])
    expect(state.active?.lockedPlayerId).toBeNull()
  })

  it('admin może wyznaczyć pytanie innemu graczowi niż wybierający kategorię', () => {
    const { state: started, ids } = startedGame()
    const category = categoryByName('Piłkarze nieznani')
    const state = admin(started, {
      type: 'openQuestion',
      categoryId: category.id,
      questionId: category.questions[2].id,
      assignedPlayerId: ids[1],
    })
    expect(state.active?.assignment?.designatorId).toBe(ids[0])
    expect(state.active?.assignment?.assignedPlayerId).toBe(ids[1])
  })

  it('nagradza poprawną odpowiedź wyznaczonego gracza i oddaje mu prawo wyznaczania', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Piłkarze nieznani', 2) // 300 pkt, wyznaczone na ids[0]
    state = admin(state, { type: 'startAnswerTimer' })
    expect(state.active?.lockedPlayerId).toBe(ids[0])
    expect(state.active?.stage).toBe('locked')
    state = admin(state, { type: 'judge', playerId: ids[0], correct: true })
    expect(state.players[0].score).toBe(300)
    expect(state.currentPlayerId).toBe(ids[0])
    expect(state.active?.answerRevealed).toBe(true)
    state = admin(state, { type: 'closeQuestion' })
    expect(state.phase).toBe('board')
    const category = state.board.find((c) => c.name === 'Piłkarze nieznani')
    expect(category?.cells[2].used).toBe(true)
  })

  it('karze błędną odpowiedź; bez przejęcia wyznaczający dostaje połowę wartości i wyznacza znowu', () => {
    const { state: started, ids } = startedGame()
    const category = categoryByName('Fobie')
    let state = admin(started, {
      type: 'openQuestion',
      categoryId: category.id,
      questionId: category.questions[1].id, // 200 pkt
      assignedPlayerId: ids[1],
    })
    state = admin(state, { type: 'startAnswerTimer' })
    state = admin(state, { type: 'judge', playerId: ids[1], correct: false })
    expect(state.players[1].score).toBe(-200) // standardowa kara za błąd
    expect(state.players[0].score).toBe(100) // połowa wartości dla wyznaczającego (ids[0] != ids[1])
    expect(state.currentPlayerId).toBe(ids[0]) // wyznaczający wyznacza ponownie
    expect(state.active?.stage).toBe('resolved')
  })

  it('nie daje bonusu, gdy wyznaczający sam sobie wyznaczył pytanie (runda 1)', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Fobie', 0) // ids[0] jest i wyznaczającym, i wyznaczonym
    state = admin(state, { type: 'startAnswerTimer' })
    state = admin(state, { type: 'judge', playerId: ids[0], correct: false })
    expect(state.players[0].score).toBe(-100) // tylko standardowa kara, bez bonusu
    expect(state.currentPlayerId).toBe(ids[0])
  })

  it('nie pozwala wybrać pytania graczowi bez kolejki', () => {
    const { state: started, ids } = startedGame()
    const category = categoryByName('Piłkarze nieznani')
    const state = asPlayer(started, ids[2], {
      type: 'pick',
      categoryId: category.id,
      questionId: category.questions[0].id,
    })
    expect(state.phase).toBe('board')
    expect(state.active).toBeNull()
  })

  it('otwieranie pytań jest tylko dla admina — nawet gracz z kolejką nie otworzy go sam', () => {
    const { state: started, ids } = startedGame()
    const category = categoryByName('Piłkarze nieznani')
    const state = asPlayer(started, ids[0], {
      type: 'pick',
      categoryId: category.id,
      questionId: category.questions[0].id,
    })
    expect(state.phase).toBe('board')
    expect(state.active).toBeNull()
  })

  it('pozwala przejąć pytanie z więcej niż 2 odpowiedziami, jeśli wyznaczony nie odpowie', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Fobie', 0) // ABCD, 4 opcje, wyznaczone na ids[0]
    state = admin(state, { type: 'startAnswerTimer' })
    state = asPlayer(state, ids[1], { type: 'requestTakeover' })
    expect(state.active?.assignment?.takeoverQueue).toEqual([ids[1]])
    expect(state.takeoversUsed).toBe(1)
    state = admin(state, { type: 'judge', playerId: ids[0], correct: false })
    expect(state.players[0].score).toBe(-100)
    expect(state.active?.lockedPlayerId).toBe(ids[1])
    expect(state.active?.stage).toBe('locked')
    state = admin(state, { type: 'judge', playerId: ids[1], correct: true })
    expect(state.players[1].score).toBe(100)
    expect(state.currentPlayerId).toBe(ids[1])
  })

  it('karze gracza, który zgłosił przejęcie, jeśli pierwotny gracz jednak odpowie poprawnie', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Fobie', 0) // 100 pkt, wyznaczone na ids[0]
    state = admin(state, { type: 'startAnswerTimer' })
    state = asPlayer(state, ids[1], { type: 'requestTakeover' })
    state = admin(state, { type: 'judge', playerId: ids[0], correct: true })
    expect(state.players[0].score).toBe(100)
    expect(state.players[1].score).toBe(-100) // kara za przedwczesne przejęcie
    expect(state.currentPlayerId).toBe(ids[0])
  })

  it('nie pozwala przejąć pytania z dwiema (lub mniej) odpowiedziami', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Sanah czy Adolf Hitler', 0) // tylko 2 opcje
    state = admin(state, { type: 'startAnswerTimer' })
    state = asPlayer(state, ids[1], { type: 'requestTakeover' })
    expect(state.active?.assignment?.takeoverQueue).toEqual([])
    expect(state.takeoversUsed).toBe(0)
  })

  it('limituje przejęcia do 4 na całą grę', () => {
    const { state: started, ids } = startedGame()
    let state = started
    for (let i = 0; i < 4; i += 1) {
      state = openCell(state, 'Fobie', i)
      state = admin(state, { type: 'startAnswerTimer' })
      const assignee = state.active!.assignment!.assignedPlayerId
      const requester = ids.find((id) => id !== assignee)!
      state = asPlayer(state, requester, { type: 'requestTakeover' })
      state = admin(state, { type: 'judge', playerId: assignee, correct: true })
      state = admin(state, { type: 'closeQuestion' })
    }
    expect(state.takeoversUsed).toBe(4)
    state = openCell(state, 'Fobie', 4)
    state = admin(state, { type: 'startAnswerTimer' })
    const assignee = state.active!.assignment!.assignedPlayerId
    const requester = ids.find((id) => id !== assignee)!
    state = asPlayer(state, requester, { type: 'requestTakeover' })
    expect(state.active?.assignment?.takeoverQueue).toEqual([])
    expect(state.takeoversUsed).toBe(4)
  })
})

describe('ręczny znacznik przejmowania (allowTakeover)', () => {
  it('allowTakeover: false blokuje przejęcie mimo >2 odpowiedzi (normalnie dozwolone)', () => {
    const { state: started, ids } = startedGame()
    const question = categoryByName('Fobie').questions[0] as StandardQuestion // 4 opcje ABCD — domyślnie dozwolone
    question.allowTakeover = false
    try {
      let state = openCell(started, 'Fobie', 0)
      expect(state.active?.assignment?.canTakeover).toBe(false)
      state = admin(state, { type: 'startAnswerTimer' })
      state = asPlayer(state, ids[1], { type: 'requestTakeover' })
      expect(state.active?.assignment?.takeoverQueue).toEqual([])
      expect(state.takeoversUsed).toBe(0)
    } finally {
      delete question.allowTakeover
    }
  })

  it('allowTakeover: true włącza przejęcie mimo ≤2 odpowiedzi (normalnie zablokowane)', () => {
    const { state: started, ids } = startedGame()
    const question = categoryByName('Sanah czy Adolf Hitler').questions[0] as StandardQuestion // 2 opcje — domyślnie blokowane
    question.allowTakeover = true
    try {
      let state = openCell(started, 'Sanah czy Adolf Hitler', 0)
      expect(state.active?.assignment?.canTakeover).toBe(true)
      state = admin(state, { type: 'startAnswerTimer' })
      state = asPlayer(state, ids[1], { type: 'requestTakeover' })
      expect(state.active?.assignment?.takeoverQueue).toEqual([ids[1]])
      expect(state.takeoversUsed).toBe(1)
    } finally {
      delete question.allowTakeover
    }
  })

  it('bez znacznika (undefined) trzyma się starej reguły opartej na liczbie odpowiedzi', () => {
    const { state: started } = startedGame()
    const withChoices = openCell(started, 'Fobie', 0)
    expect(withChoices.active?.assignment?.canTakeover).toBe(true) // 4 opcje
    const { state: started2 } = startedGame()
    const withoutEnoughChoices = openCell(started2, 'Sanah czy Adolf Hitler', 0)
    expect(withoutEnoughChoices.active?.assignment?.canTakeover).toBe(false) // 2 opcje
  })
})

describe('media odpowiedzi — limit rozmiaru dla graczy', () => {
  it('mały wgrany plik trafia do graczy w `answerMedia`, duży zostaje tylko na hoście', () => {
    const { state: started } = startedGame()
    const question = categoryByName('Fobie').questions[0] as StandardQuestion
    const originalAnswerMedia = question.answerMedia
    // approxDataUrlBytes liczy `src.length * 0.75` — dobieramy długości tak, żeby jedna
    // wersja wypadła bezpiecznie poniżej `MAX_PLAYER_MEDIA_BYTES`, a druga powyżej.
    const small = `data:audio/mp3;base64,${'A'.repeat(1000)}`
    const bigLength = Math.ceil(MAX_PLAYER_MEDIA_BYTES / 0.75) + 1000
    const big = `data:audio/mp3;base64,${'A'.repeat(bigLength)}`
    try {
      question.answerMedia = { kind: 'audio', src: small }
      let state = openCell(started, 'Fobie', 0)
      state = admin(state, { type: 'revealAnswer' })
      expect(state.active?.answerMedia?.src).toBe(small)

      question.answerMedia = { kind: 'audio', src: big }
      let state2 = openCell(started, 'Fobie', 0)
      state2 = admin(state2, { type: 'revealAnswer' })
      expect(state2.active?.answerMedia?.src).toBeUndefined()
      expect(state2.active?.answerMedia?.kind).toBe('audio') // rodzaj i etykieta zostają — tylko `src` jest ucięte
    } finally {
      question.answerMedia = originalAnswerMedia
    }
  })
})

describe('koło fortuny', () => {
  beforeEach(() => {
    const index = WHEEL_SEGMENTS.findIndex((segment) => segment.value === 150)
    vi.spyOn(Math, 'random').mockReturnValue(index / WHEEL_SEGMENTS.length)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('dolicza trafienia do puli (jako bonus) i wypłaca wartość pytania z pulą', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Koło fortuny', 0) // KOŃ JAKI JEST KAŻDY WIDZI, 200 pkt
    expect(state.active?.wheel?.turnPlayerId).toBe(ids[0])
    state = asPlayer(state, ids[0], { type: 'wheelSpin' })
    expect(state.active?.wheel?.spinValue).toBe(150)
    state = asPlayer(state, ids[0], { type: 'wheelLetter', letter: 'K' })
    // K występuje 3× w haśle "KOŃ JAKI JEST KAŻDY WIDZI"
    expect(state.active?.wheel?.pool).toBe(450)
    expect(state.active?.wheel?.spinValue).toBeNull()
    expect(state.active?.wheel?.masked.join('')).toContain('K')

    state = asPlayer(state, ids[0], { type: 'wheelSolve', text: 'KOŃ JAKI JEST KAŻDY WIDZI' })
    state = admin(state, { type: 'wheelJudge', correct: true })
    expect(state.players[0].score).toBe(650)
    expect(state.active?.stage).toBe('resolved')
  })

  it('przekazuje kolejkę po nietrafionej literze i pobiera opłatę za samogłoskę z punktów gracza', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Koło fortuny', 0)
    state = asPlayer(state, ids[0], { type: 'wheelSpin' })
    state = asPlayer(state, ids[0], { type: 'wheelLetter', letter: 'C' })
    expect(state.active?.wheel?.turnPlayerId).toBe(ids[1])
    expect(state.active?.wheel?.pool).toBe(0)

    state = asPlayer(state, ids[1], { type: 'wheelSpin' })
    state = asPlayer(state, ids[1], { type: 'wheelLetter', letter: 'K' })
    expect(state.active?.wheel?.pool).toBe(450)

    // Samogłoska kosztuje punkty gracza, nie pulę — bez własnych punktów zakup jest odrzucany.
    state = asPlayer(state, ids[1], { type: 'wheelBuyVowel', letter: 'A' })
    expect(state.active?.wheel?.masked.join('')).not.toContain('A')

    state = admin(state, { type: 'adjustScore', playerId: ids[1], delta: 200 })
    state = asPlayer(state, ids[1], { type: 'wheelBuyVowel', letter: 'A' })
    expect(state.active?.wheel?.pool).toBe(450)
    expect(state.players.find((p) => p.id === ids[1])?.score).toBe(100)
    expect(state.active?.wheel?.masked.join('')).toContain('A')
  })
})

describe('wyliczanka (Wyliż chunka)', () => {
  it('eliminuje po drugiej pomyłce i rozlicza stałe wypłaty za miejsca (niezależnie od pola)', () => {
    const { state: started, ids } = startedGame(['Ala', 'Bolek', 'Cezary', 'Dagmara'])
    let state = openCell(started, 'Wyliż chunka', 0) // wartość pola nie ma tu znaczenia
    expect(state.active?.list?.lives[ids[0]]).toBe(2)

    state = admin(state, { type: 'listToggleItem', index: 0 })
    expect(state.active?.list?.found[0].playerId).toBe(ids[0])
    expect(state.active?.list?.turnPlayerId).toBe(ids[1])

    // Dagmara i Cezary odpadają, zostaje Ala i Bolek -> rozliczenie ręczne
    state = admin(state, { type: 'listMiss', playerId: ids[3] })
    state = admin(state, { type: 'listMiss', playerId: ids[3] })
    expect(state.active?.list?.eliminated).toContain(ids[3])
    state = admin(state, { type: 'listMiss', playerId: ids[2] })
    state = admin(state, { type: 'listMiss', playerId: ids[2] })
    state = admin(state, { type: 'listMiss', playerId: ids[1] })
    state = admin(state, { type: 'listMiss', playerId: ids[1] })

    // po eliminacji trzech graczy konkurencja rozlicza się sama
    const list = state.active?.list
    expect(list?.settled).toBe(true)
    expect(list?.payouts.map((payout) => payout.playerId)).toEqual([ids[0], ids[1], ids[2], ids[3]])
    // Stałe wypłaty niezależne od wylosowanego pola: 600, 400, 200, 0 (domyślne rules).
    expect(list?.payouts.map((payout) => payout.delta)).toEqual([600, 400, 200, 0])
    expect(state.players[0].score).toBe(600)
    expect(state.players[1].score).toBe(400)
    expect(state.players[2].score).toBe(200)
    expect(state.players[3].score).toBe(0)
  })
})

describe('licytacje', () => {
  it('podbija stawkę, zatrzymuje licytację i rozlicza wynik', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Licytacje', 1) // stałe 300 pkt niezależnie od pola
    state = asPlayer(state, ids[0], { type: 'auctionBid' })
    state = asPlayer(state, ids[1], { type: 'auctionBid' })
    state = asPlayer(state, ids[1], { type: 'auctionBid' }) // nie podbija sam siebie
    expect(state.active?.auction?.bid).toBe(2)
    expect(state.active?.auction?.leaderId).toBe(ids[1])

    state = admin(state, { type: 'auctionStop' })
    expect(state.active?.auction?.stage).toBe('listing')
    expect(state.active?.auction?.timerRunning).toBe(true)

    state = admin(state, { type: 'auctionToggleItem', index: 0 })
    state = admin(state, { type: 'auctionToggleItem', index: 1 })
    expect(state.active?.auction?.found).toHaveLength(2)

    state = admin(state, { type: 'auctionJudge', correct: false })
    expect(state.players[1].score).toBe(-300)
  })
})

describe('rozłączenia i heartbeat', () => {
  it('setConnected zapisuje moment rozłączenia i czyści go po powrocie', () => {
    const { state: started, ids } = startedGame()
    let state = setConnected(started, ids[0], false)
    const disconnectedAt = state.players[0].disconnectedAt
    expect(state.players[0].connected).toBe(false)
    expect(disconnectedAt).not.toBeNull()

    // Ponowne wywołanie "disconnected" (np. przez heartbeat po spóźnionym close) nie
    // przesuwa momentu rozłączenia — liczy się, kiedy naprawdę zniknął, nie kiedy zauważyliśmy.
    vi.useFakeTimers()
    vi.advanceTimersByTime(5000)
    state = setConnected(state, ids[0], false)
    expect(state.players[0].disconnectedAt).toBe(disconnectedAt)
    vi.useRealTimers()

    state = setConnected(state, ids[0], true)
    expect(state.players[0].connected).toBe(true)
    expect(state.players[0].disconnectedAt).toBeNull()
  })

  it('wheelPassTurn loguje, którego gracza pominięto', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Koło fortuny', 0)
    expect(state.active?.wheel?.turnPlayerId).toBe(ids[0])
    state = admin(state, { type: 'wheelPassTurn' })
    expect(state.active?.wheel?.turnPlayerId).toBe(ids[1])
    expect(state.log[0].text).toContain(state.players[0].name)
  })
})

describe('wyrzucanie gracza w trakcie gry', () => {
  it('zwalnia zablokowanego gracza w pytaniu zwykłym, gdy admin go wyrzuca', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Piłkarze nieznani', 0) // wyznaczone na ids[0]
    state = admin(state, { type: 'startAnswerTimer' })
    expect(state.active?.lockedPlayerId).toBe(ids[0])

    state = admin(state, { type: 'removePlayer', playerId: ids[0] })
    expect(state.players.find((p) => p.id === ids[0])).toBeUndefined()
    expect(state.active?.lockedPlayerId).toBeNull()
  })

  it('przesuwa kolejkę w kole fortuny, gdy wyrzucany jest gracz, który akurat kręci', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Koło fortuny', 0)
    expect(state.active?.wheel?.turnPlayerId).toBe(ids[0])

    state = admin(state, { type: 'removePlayer', playerId: ids[0] })
    expect(state.active?.wheel?.order).not.toContain(ids[0])
    expect(state.active?.wheel?.turnPlayerId).toBe(ids[1])
  })

  it('czyści lidera licytacji, gdy admin go wyrzuca', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Licytacje', 0)
    state = asPlayer(state, ids[1], { type: 'auctionBid' })
    expect(state.active?.auction?.leaderId).toBe(ids[1])

    state = admin(state, { type: 'removePlayer', playerId: ids[1] })
    expect(state.active?.auction?.leaderId).toBeNull()
  })

  it('usuwa gracza z obstawiania finałowego, żeby nie blokował odkrywania odpowiedzi', () => {
    const { state: started, ids } = startedGame()
    let state = admin(started, { type: 'startFinal' })
    state = admin(state, { type: 'finalStage', stage: 'wagering' })
    state = asPlayer(state, ids[0], { type: 'finalWager', amount: 500 })
    expect(state.final?.wagers[ids[0]]).toBe(500)

    state = admin(state, { type: 'removePlayer', playerId: ids[0] })
    expect(state.final?.wagers[ids[0]]).toBeUndefined()
  })
})

describe('finał', () => {
  it('obstawianie, ocena i zmiana werdyktu', () => {
    const { state: started, ids } = startedGame()
    let state = admin(started, { type: 'adjustScore', playerId: ids[0], delta: 2000 })
    state = admin(state, { type: 'startFinal' })
    expect(state.phase).toBe('final')
    expect(state.final?.stage).toBe('category')
    expect(state.final?.category).toBe(pack.final[0].category)
    expect(state.final?.prompt).toBeNull()

    state = admin(state, { type: 'finalStage', stage: 'wagering' })
    state = asPlayer(state, ids[0], { type: 'finalWager', amount: 5000 })
    expect(state.final?.wagers[ids[0]]).toBe(2000) // przycięte do stanu konta

    state = admin(state, { type: 'finalStage', stage: 'question' })
    expect(state.final?.prompt).toBe(pack.final[0].prompt)
    state = asPlayer(state, ids[0], { type: 'finalAnswer', text: 'Gabriel Narutowicz' })
    expect(state.final?.submitted[ids[0]]).toBe(true)

    state = admin(state, { type: 'finalStage', stage: 'reveal' })
    state = admin(state, { type: 'finalJudge', playerId: ids[0], correct: true })
    expect(state.players[0].score).toBe(4000)
    expect(state.final?.revealed).toContain(ids[0])

    // zmiana decyzji cofa poprzednią wypłatę
    state = admin(state, { type: 'finalJudge', playerId: ids[0], correct: false })
    expect(state.players[0].score).toBe(0)

    state = admin(state, { type: 'finalRevealAnswer' })
    expect(state.final?.answerText).toBe(pack.final[0].answerText)

    state = admin(state, { type: 'finalNextQuestion' })
    expect(state.final?.index).toBe(1)
    expect(state.final?.wagers).toEqual({})
  })

  it('kończy grę po ostatnim pytaniu finałowym', () => {
    const { state: started } = startedGame()
    let state = admin(started, { type: 'startFinal' })
    for (let i = 0; i < pack.final.length; i += 1) {
      state = admin(state, { type: 'finalNextQuestion' })
    }
    expect(state.phase).toBe('results')
  })
})

describe('reset', () => {
  it('zeruje punkty, zostawia graczy', () => {
    const { state: started, ids } = startedGame()
    let state = admin(started, { type: 'adjustScore', playerId: ids[0], delta: 500 })
    state = admin(state, { type: 'resetGame' })
    expect(state.phase).toBe('lobby')
    expect(state.players).toHaveLength(3)
    expect(state.players.every((player) => player.score === 0)).toBe(true)
  })
})

describe('runda 2 (dwie plansze)', () => {
  // Osobny pakiet, żeby nie mieszać `round` do współdzielonego `pack` z testów powyżej. Rundzie 1
  // zostają tylko kategorie "zwykłe" (standard) — Koło fortuny / Wyliż chunka / Licytacje idą do
  // Rundy 2 — tak, żeby móc wyczerpać Rundę 1 samym generycznym `judge: true`.
  const ROUND2_NAMES = ['Koło fortuny', 'Wyliż chunka', 'Licytacje']
  const round2Pack: Pack = structuredClone(DEFAULT_PACK)
  round2Pack.categories = round2Pack.categories.map((category) => ({
    ...category,
    round: ROUND2_NAMES.includes(category.name) ? 2 : 1,
  }))

  function admin2(state: GameState, action: AdminAction) {
    return applyAction(round2Pack, state, { source: 'admin', action })
  }
  function asPlayer2(state: GameState, playerId: string, action: PlayerAction) {
    return applyAction(round2Pack, state, { source: 'player', playerId, action })
  }

  function lobby2(names: string[]) {
    let state = createInitialState(round2Pack, 'TEST2')
    const ids: string[] = []
    names.forEach((name) => {
      const result = joinPlayer(state, { name, avatar: '🦊' })
      state = result.state
      ids.push(result.playerId)
    })
    return { state, ids }
  }

  function resolveEstimation(state: GameState, ids: string[]) {
    let next = state
    if (next.phase === 'estimation' && next.estimation) {
      const correct =
        round2Pack.estimation.find((q) => q.id === next.estimation?.questionId)?.answer ?? 0
      ids.forEach((id, index) => {
        next = asPlayer2(next, id, { type: 'estimateGuess', amount: correct + index })
      })
      next = admin2(next, { type: 'estimateReveal' })
      next = admin2(next, { type: 'estimateAdvance' })
    }
    return next
  }

  it('buduje planszę ze wszystkich kategorii, ale pokazuje tylko Rundę 1 na start', () => {
    const { state: lobby, ids } = lobby2(['Ala', 'Bolek'])
    let state = admin2(lobby, { type: 'startGame' })
    state = resolveEstimation(state, ids)
    expect(state.round).toBe(1)
    expect(state.board).toHaveLength(round2Pack.categories.length)
    const round1Categories = state.board.filter((c) => c.round === 1)
    const round2Categories = state.board.filter((c) => c.round === 2)
    expect(round1Categories).toHaveLength(5)
    expect(round2Categories).toHaveLength(3)
  })

  it('setRound pozwala adminowi ręcznie przełączać planszę, bez rundy oszacowania i bez wymogu wyczerpania', () => {
    const { state: lobby, ids } = lobby2(['Ala', 'Bolek'])
    let state = admin2(lobby, { type: 'startGame' })
    state = resolveEstimation(state, ids)
    expect(state.phase).toBe('board')
    expect(state.round).toBe(1)

    // Plansza 1 daleka od wyczerpania — startRound2 by to zignorował, ale setRound i tak przełącza.
    state = admin2(state, { type: 'setRound', round: 2 })
    expect(state.round).toBe(2)
    expect(state.phase).toBe('board') // żadnej nowej rundy oszacowania
    expect(state.estimation).toBeNull()
    expect(state.currentPlayerId).not.toBeNull() // kolejka picking rights niezmieniona

    // I z powrotem.
    state = admin2(state, { type: 'setRound', round: 1 })
    expect(state.round).toBe(1)
  })

  it('setRound jest ignorowany poza fazą planszy i gdy pakiet nie ma Rundy 2', () => {
    const { state: lobby, ids } = lobby2(['Ala', 'Bolek'])
    let state = admin2(lobby, { type: 'startGame' })
    // Wciąż w fazie 'estimation' — setRound nie powinien nic zrobić.
    expect(state.phase).toBe('estimation')
    const duringEstimation = admin2(state, { type: 'setRound', round: 2 })
    expect(duringEstimation.round).toBe(1)

    state = resolveEstimation(state, ids)
    const category = round2Pack.categories.find((c) => (c.round ?? 1) === 1)!
    state = admin2(state, {
      type: 'openQuestion',
      categoryId: category.id,
      questionId: category.questions[0].id,
    })
    expect(state.phase).toBe('question')
    const duringQuestion = admin2(state, { type: 'setRound', round: 2 })
    expect(duringQuestion.round).toBe(1)

    // Pakiet startowy bez Rundy 2 w ogóle — setRound zawsze no-op.
    const { state: plainState } = startedGame()
    const afterNoop = admin(plainState, { type: 'setRound', round: 2 })
    expect(afterNoop.round).toBe(1)
  })

  it('startRound2 jest ignorowany, dopóki plansza Rundy 1 nie jest pusta', () => {
    const { state: lobby, ids } = lobby2(['Ala', 'Bolek'])
    let state = admin2(lobby, { type: 'startGame' })
    state = resolveEstimation(state, ids)
    expect(state.phase).toBe('board')
    state = admin2(state, { type: 'startRound2' })
    expect(state.round).toBe(1)
    expect(state.phase).toBe('board')
    expect(state.estimation).toBeNull()
  })

  it('po wyczerpaniu Rundy 1 startRound2 przełącza planszę i otwiera nową rundę oszacowania', () => {
    const { state: lobby, ids } = lobby2(['Ala', 'Bolek'])
    let state = admin2(lobby, { type: 'startGame' })
    state = resolveEstimation(state, ids)

    // Grind through every question in Runda 1's categories, always judging correct so the board
    // just empties out without touching Runda 2.
    const round1Cats = round2Pack.categories.filter((c) => (c.round ?? 1) === 1)
    for (const category of round1Cats) {
      for (let row = 0; row < category.questions.length; row += 1) {
        state = admin2(state, {
          type: 'openQuestion',
          categoryId: category.id,
          questionId: category.questions[row].id,
        })
        state = admin2(state, { type: 'startAnswerTimer' })
        const holderId = state.active!.lockedPlayerId!
        state = admin2(state, { type: 'judge', playerId: holderId, correct: true })
        state = admin2(state, { type: 'closeQuestion' })
      }
    }

    expect(state.phase).toBe('board')
    expect(state.round).toBe(1)
    expect(state.board.filter((c) => c.round === 1).every((c) => c.cells.every((cell) => cell.used))).toBe(
      true,
    )
    // Runda 2's board is still untouched.
    expect(state.board.filter((c) => c.round === 2).every((c) => c.cells.every((cell) => !cell.used))).toBe(
      true,
    )

    state = admin2(state, { type: 'startRound2' })
    expect(state.round).toBe(2)
    expect(state.phase).toBe('estimation')
    expect(state.estimation?.eligiblePlayerIds.sort()).toEqual([...ids].sort())

    state = resolveEstimation(state, ids)
    expect(state.phase).toBe('board')
    expect(ids).toContain(state.currentPlayerId)

    // Only Runda 2's categories are pickable now.
    const round2Cat = round2Pack.categories.find((c) => (c.round ?? 1) === 2)!
    state = admin2(state, {
      type: 'openQuestion',
      categoryId: round2Cat.id,
      questionId: round2Cat.questions[0].id,
    })
    expect(state.active?.categoryId).toBe(round2Cat.id)
  })

  it('gra bez kategorii Rundy 2 (pakiet startowy) nigdy nie zmienia rundy', () => {
    expect(hasRound2(pack)).toBe(false)
    const { state } = startedGame()
    expect(state.round).toBe(1)
    const afterNoop = admin(state, { type: 'startRound2' })
    expect(afterNoop.round).toBe(1)
  })
})

describe('punkty startowe', () => {
  // Osobny, NIEskorygowany klon DEFAULT_PACK — moduł-owy `pack` powyżej celowo ustawia
  // startingScore na 0, żeby testy z dokładnymi deltami zostały czytelne. Tu sprawdzamy
  // naprawdę wysyłany domyślny pakiet (startingScore: 2000).
  const freshPack: Pack = structuredClone(DEFAULT_PACK)

  function adminFresh(state: GameState, action: AdminAction) {
    return applyAction(freshPack, state, { source: 'admin', action })
  }

  it('pakiet startowy domyślnie ma 2000 punktów startowych', () => {
    expect(freshPack.rules.startingScore).toBe(2000)
  })

  it('gracz dołączający do lobby zaczyna z punktami startowymi pakietu', () => {
    let state = createInitialState(freshPack, 'TESTSTART')
    const { state: joined } = joinPlayer(state, { name: 'Ala', avatar: '🦊' })
    state = joined
    expect(state.players[0].score).toBe(2000)
  })

  it('gracz lokalny (hot-seat) też zaczyna z punktami startowymi pakietu', () => {
    const state = adminFresh(createInitialState(freshPack, 'TESTSTART'), {
      type: 'addLocalPlayer',
      name: 'Bolek',
    })
    expect(state.players[0].score).toBe(2000)
  })

  it('resetGame wraca do punktów startowych, nie do zera', () => {
    let state = createInitialState(freshPack, 'TESTSTART')
    state = joinPlayer(state, { name: 'Ala', avatar: '🦊' }).state
    state = adminFresh(state, { type: 'adjustScore', playerId: state.players[0].id, delta: 500 })
    expect(state.players[0].score).toBe(2500)
    state = adminFresh(state, { type: 'resetGame' })
    expect(state.players[0].score).toBe(2000)
  })
})
