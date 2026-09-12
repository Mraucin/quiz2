import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PACK, WHEEL_SEGMENTS } from './defaultPack'
import { applyAction, createInitialState, joinPlayer } from './engine'
import type { AdminAction, GameState, Pack, PlayerAction } from './types'

const pack: Pack = structuredClone(DEFAULT_PACK)

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
  const { state, ids } = lobbyWithPlayers(names)
  return { state: admin(state, { type: 'startGame' }), ids }
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

describe('pytania zwykłe', () => {
  it('nagradza poprawną odpowiedź i przekazuje wybór graczowi', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Piłkarze nieznani', 2)
    state = admin(state, { type: 'setBuzzers', open: true })
    state = asPlayer(state, ids[1], { type: 'buzz' })
    expect(state.active?.lockedPlayerId).toBe(ids[1])
    expect(state.active?.buzzersOpen).toBe(false)
    state = admin(state, { type: 'judge', playerId: ids[1], correct: true })
    expect(state.players[1].score).toBe(300)
    expect(state.currentPlayerId).toBe(ids[1])
    expect(state.active?.answerRevealed).toBe(true)
    state = admin(state, { type: 'closeQuestion' })
    expect(state.phase).toBe('board')
    const category = state.board.find((c) => c.name === 'Piłkarze nieznani')
    expect(category?.cells[2].used).toBe(true)
  })

  it('karze błąd bez pauzy — gracz gra dalej normalnie', () => {
    const { state: started, ids } = startedGame()
    let state = openCell(started, 'Fobie', 1)
    state = admin(state, { type: 'setBuzzers', open: true })
    state = asPlayer(state, ids[0], { type: 'buzz' })
    state = admin(state, { type: 'judge', playerId: ids[0], correct: false })
    expect(state.players[0].score).toBe(-200)
    expect(state.active?.buzzersOpen).toBe(true)
    // gracz po błędzie nie może zgłosić się ponownie do tego samego pytania…
    state = asPlayer(state, ids[0], { type: 'buzz' })
    expect(state.active?.lockedPlayerId).toBeNull()
    // …ale nie ma żadnej pauzy — normalnie wraca do kolejki wyboru kategorii.
    state = admin(state, { type: 'closeQuestion' })
    expect(state.currentPlayerId).toBe(ids[1])
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

  it('zgłoszenia są otwarte od razu po otwarciu pytania przez admina', () => {
    const { state: started } = startedGame()
    const state = openCell(started, 'Fobie', 0)
    expect(state.active?.buzzersOpen).toBe(true)
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
