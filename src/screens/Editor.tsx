import { useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Download,
  Plus,
  RefreshCcw,
  Trash2,
  Upload,
} from 'lucide-react'
import { MediaEditor } from '@/components/editor/MediaEditor'
import { HostGate } from '@/components/HostGate'
import { Button } from '@/components/ui/button'
import { Badge, Input, Label, Panel, PanelTitle, Select, Textarea } from '@/components/ui/primitives'
import { DEFAULT_PACK } from '@/lib/defaultPack'
import { cellValue } from '@/lib/engine'
import { approximatePackSize, downloadPack, formatBytes, readPackFile } from '@/lib/storage'
import type { Category, FinalQuestion, Pack, Question, QuestionKind } from '@/lib/types'
import { cn, formatPoints, randomId } from '@/lib/utils'

const kindNames: Record<QuestionKind, string> = {
  standard: 'Zwykłe (ABCD lub otwarte)',
  wheel: 'Koło fortuny',
  list: 'Wyliczanka (Wyliż chunka)',
  auction: 'Licytacja',
}

function convertKind(question: Question, kind: QuestionKind): Question {
  const base = {
    id: question.id,
    prompt: question.prompt,
    media: question.media,
    answerText: question.answerText,
    answerMedia: question.answerMedia,
    notes: question.notes,
    speak: question.speak,
  }
  if (kind === 'standard') return { ...base, kind: 'standard' }
  if (kind === 'wheel')
    return {
      ...base,
      kind: 'wheel',
      phrase: 'phrase' in question ? question.phrase : (question.answerText ?? 'NOWE HASŁO'),
      phraseHint: 'phraseHint' in question ? question.phraseHint : 'Rzecz',
    }
  if (kind === 'list')
    return {
      ...base,
      kind: 'list',
      items: 'items' in question ? question.items : [],
      freeMisses: 1,
    }
  return {
    ...base,
    kind: 'auction',
    items: 'items' in question ? question.items : [],
    timerSeconds: 60,
  }
}

function emptyQuestion(): Question {
  return { id: randomId('q'), kind: 'standard', prompt: 'Nowe pytanie', answerText: '' }
}

// Gates the real editor behind the pack's PIN (see HostGate) so a player who lands here
// can't read the question bank or answer keys.
export function EditorScreen({
  pack,
  setPack,
  navigate,
}: {
  pack: Pack
  setPack: (pack: Pack) => void
  navigate: (path: string) => void
}) {
  return (
    <HostGate pack={pack} navigate={navigate}>
      <EditorScreenContent pack={pack} setPack={setPack} navigate={navigate} />
    </HostGate>
  )
}

function EditorScreenContent({
  pack,
  setPack,
  navigate,
}: {
  pack: Pack
  setPack: (pack: Pack) => void
  navigate: (path: string) => void
}) {
  const [categoryIndex, setCategoryIndex] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [tab, setTab] = useState<'board' | 'final' | 'rules'>('board')
  const fileInput = useRef<HTMLInputElement>(null)
  const category = pack.categories[categoryIndex]
  const question = category?.questions[questionIndex]

  const patchPack = (patch: Partial<Pack>) => setPack({ ...pack, ...patch })

  const patchCategory = (index: number, patch: Partial<Category>) =>
    patchPack({
      categories: pack.categories.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })

  const patchQuestion = (patch: Partial<Question>) => {
    if (!category || !question) return
    patchCategory(categoryIndex, {
      questions: category.questions.map((item, i) =>
        i === questionIndex ? ({ ...item, ...patch } as Question) : item,
      ),
    })
  }

  const patchFinal = (index: number, patch: Partial<FinalQuestion>) =>
    patchPack({
      final: pack.final.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    })

  return (
    <div className="mx-auto flex max-w-[100rem] flex-col gap-4 p-3 sm:p-5">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <div className="text-display text-xl leading-none text-gold">Edytor pytań</div>
          <div className="text-xs text-white/50">
            Zapis automatyczny w tej przeglądarce · {formatBytes(approximatePackSize(pack))}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (!file) return
              try {
                setPack(await readPackFile(file))
                setCategoryIndex(0)
                setQuestionIndex(0)
              } catch (error) {
                window.alert(error instanceof Error ? error.message : 'Błąd importu')
              }
            }}
          />
          <Button variant="secondary" onClick={() => fileInput.current?.click()}>
            <Upload className="size-4" /> Import
          </Button>
          <Button variant="secondary" onClick={() => downloadPack(pack)}>
            <Download className="size-4" /> Eksport
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Przywrócić pakiet startowy? Twoje zmiany zostaną utracone.')) {
                setPack(structuredClone(DEFAULT_PACK))
              }
            }}
          >
            <RefreshCcw className="size-4" /> Pakiet startowy
          </Button>
          <Button variant="primary" onClick={() => navigate('/admin')}>
            Prowadź grę
          </Button>
        </div>
      </header>

      <Panel className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Label>Nazwa pakietu</Label>
          <Input value={pack.name} onChange={(event) => patchPack({ name: event.target.value })} />
        </div>
        <div className="min-w-[16rem] flex-[2]">
          <Label>Opis</Label>
          <Input
            value={pack.description ?? ''}
            onChange={(event) => patchPack({ description: event.target.value })}
          />
        </div>
        <div className="flex gap-1">
          {(['board', 'final', 'rules'] as const).map((value) => (
            <Button
              key={value}
              variant={tab === value ? 'primary' : 'secondary'}
              onClick={() => setTab(value)}
            >
              {value === 'board' ? 'Plansza' : value === 'final' ? 'Finał' : 'Zasady'}
            </Button>
          ))}
        </div>
      </Panel>

      {tab === 'board' ? (
        <div className="grid gap-4 lg:grid-cols-[16rem_16rem_minmax(0,1fr)]">
          <Panel className="flex flex-col gap-2">
            <PanelTitle>Kategorie ({pack.categories.length})</PanelTitle>
            {pack.categories.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCategoryIndex(index)
                  setQuestionIndex(0)
                }}
                className={cn(
                  'flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition',
                  index === categoryIndex
                    ? 'border-gold/70 bg-gold/10'
                    : 'border-stage-600 hover:bg-white/5',
                )}
              >
                <span className="text-display w-5 text-white/40">{index + 1}</span>
                <Badge tone={(item.round ?? 1) === 2 ? 'violet' : 'neutral'}>
                  R{item.round ?? 1}
                </Badge>
                <span className="flex-1 truncate">{item.name}</span>
                {item.fixedValue != null ? (
                  <Badge tone="violet">stałe {item.fixedValue}</Badge>
                ) : item.multiplier !== 1 ? (
                  <Badge tone={item.multiplier > 1 ? 'mint' : 'coral'}>×{item.multiplier}</Badge>
                ) : null}
              </button>
            ))}
            <Button
              variant="secondary"
              onClick={() =>
                patchPack({
                  categories: [
                    ...pack.categories,
                    {
                      id: randomId('cat'),
                      name: 'Nowa kategoria',
                      multiplier: 1,
                      round: 1,
                      questions: Array.from({ length: 6 }, emptyQuestion),
                    },
                  ],
                })
              }
            >
              <Plus className="size-4" /> Dodaj kategorię
            </Button>
          </Panel>

          {category ? (
            <Panel className="flex flex-col gap-2">
              <PanelTitle>Kategoria</PanelTitle>
              <Input
                value={category.name}
                onChange={(event) => patchCategory(categoryIndex, { name: event.target.value })}
              />
              <div className="flex items-center gap-2">
                <Label className="mb-0 flex-1">Plansza (runda)</Label>
                <div className="flex overflow-hidden rounded-lg border border-stage-600">
                  {([1, 2] as const).map((round) => (
                    <button
                      key={round}
                      type="button"
                      onClick={() => patchCategory(categoryIndex, { round })}
                      className={cn(
                        'px-3 py-1.5 text-sm font-semibold transition',
                        (category.round ?? 1) === round
                          ? 'bg-gold text-stage-900'
                          : 'bg-transparent text-white/60 hover:bg-white/5',
                      )}
                    >
                      Runda {round}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Label className="mb-0 flex-1">Mnożnik punktów</Label>
                <Select
                  className="h-9 w-24"
                  disabled={category.fixedValue != null}
                  value={category.multiplier}
                  onChange={(event) => {
                    const raw = Number(event.target.value)
                    const multiplier = raw === 2 ? 2 : raw === 0.5 ? 0.5 : 1
                    patchCategory(categoryIndex, { multiplier })
                  }}
                >
                  <option value={0.5}>×0.5</option>
                  <option value={1}>×1</option>
                  <option value={2}>×2</option>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex flex-1 items-center gap-2 text-sm text-white/70">
                  <input
                    type="checkbox"
                    checked={category.fixedValue != null}
                    onChange={(event) =>
                      patchCategory(categoryIndex, {
                        fixedValue: event.target.checked ? 600 : undefined,
                      })
                    }
                  />
                  Stała wartość wszystkich pytań
                </label>
                {category.fixedValue != null ? (
                  <Input
                    className="h-9 w-24"
                    inputMode="numeric"
                    value={category.fixedValue}
                    onChange={(event) =>
                      patchCategory(categoryIndex, { fixedValue: Number(event.target.value) || 0 })
                    }
                  />
                ) : null}
              </div>
              {category.fixedValue != null ? (
                <p className="text-xs text-white/45">
                  Każde pytanie w tej kategorii jest warte {formatPoints(category.fixedValue)} — mnożnik
                  jest ignorowany, dopóki ta opcja jest włączona.
                </p>
              ) : null}
              <div className="mt-1 flex flex-col gap-1">
                {category.questions.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setQuestionIndex(index)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition',
                      index === questionIndex
                        ? 'border-gold/70 bg-gold/10'
                        : 'border-stage-600 hover:bg-white/5',
                    )}
                  >
                    <span className="text-display w-12 text-gold">
                      {formatPoints(cellValue(pack, category, index))}
                    </span>
                    <span className="flex-1 truncate">{item.prompt || '(puste)'}</span>
                  </button>
                ))}
              </div>
              <div className="mt-1 flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    patchCategory(categoryIndex, {
                      questions: [...category.questions, emptyQuestion()],
                    })
                  }
                >
                  <Plus className="size-4" /> Pytanie
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    if (!window.confirm(`Usunąć kategorię „${category.name}”?`)) return
                    patchPack({ categories: pack.categories.filter((_, i) => i !== categoryIndex) })
                    setCategoryIndex(0)
                    setQuestionIndex(0)
                  }}
                >
                  <Trash2 className="size-4 text-coral" /> Usuń kategorię
                </Button>
              </div>
            </Panel>
          ) : null}

          {category && question ? (
            <Panel className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <PanelTitle>
                  Pytanie za {formatPoints(cellValue(pack, category, questionIndex))}
                </PanelTitle>
                <div className="flex items-center gap-2">
                  <Select
                    className="h-9 w-64"
                    value={question.kind}
                    onChange={(event) =>
                      patchCategory(categoryIndex, {
                        questions: category.questions.map((item, i) =>
                          i === questionIndex
                            ? convertKind(item, event.target.value as QuestionKind)
                            : item,
                        ),
                      })
                    }
                  >
                    {Object.entries(kindNames).map(([value, text]) => (
                      <option key={value} value={value}>
                        {text}
                      </option>
                    ))}
                  </Select>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={category.questions.length <= 1}
                    onClick={() => {
                      patchCategory(categoryIndex, {
                        questions: category.questions.filter((_, i) => i !== questionIndex),
                      })
                      setQuestionIndex(0)
                    }}
                  >
                    <Trash2 className="size-4 text-coral" />
                  </Button>
                </div>
              </div>

              <div>
                <Label>Treść pytania</Label>
                <Textarea
                  rows={3}
                  value={question.prompt}
                  onChange={(event) => patchQuestion({ prompt: event.target.value })}
                />
              </div>

              <MediaEditor
                label="Multimedia w pytaniu"
                value={question.media}
                onChange={(media) => patchQuestion({ media })}
              />

              <div>
                <Label>Tekst dla lektora (synteza mowy, pytania audio)</Label>
                <Input
                  value={question.speak ?? ''}
                  placeholder="np. スーパーマリオブラザーズ"
                  onChange={(event) => patchQuestion({ speak: event.target.value })}
                />
              </div>

              {question.kind === 'standard' ? (
                <StandardFields question={question} patchQuestion={patchQuestion} />
              ) : null}
              {question.kind === 'wheel' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Hasło</Label>
                    <Input
                      value={question.phrase}
                      onChange={(event) =>
                        patchQuestion({
                          phrase: event.target.value.toUpperCase(),
                          answerText: event.target.value.toUpperCase(),
                        } as Partial<Question>)
                      }
                    />
                  </div>
                  <div>
                    <Label>Kategoria hasła</Label>
                    <Input
                      value={question.phraseHint}
                      onChange={(event) =>
                        patchQuestion({ phraseHint: event.target.value } as Partial<Question>)
                      }
                    />
                  </div>
                </div>
              ) : null}
              {question.kind === 'list' || question.kind === 'auction' ? (
                <div>
                  <Label>
                    Lista poprawnych odpowiedzi — jedna na linię ({question.items.length})
                  </Label>
                  <Textarea
                    rows={8}
                    value={question.items.join('\n')}
                    onChange={(event) =>
                      // Keep every line exactly as typed (no trim/filter) while editing —
                      // otherwise a just-pressed Enter creates a blank line that this same
                      // handler immediately strips out again, so the cursor never seems to move
                      // to a new line. Blank/whitespace-only lines get cleaned up on blur instead.
                      patchQuestion({
                        items: event.target.value.split('\n'),
                      } as Partial<Question>)
                    }
                    onBlur={(event) =>
                      patchQuestion({
                        items: event.target.value
                          .split('\n')
                          .map((line) => line.trim())
                          .filter(Boolean),
                      } as Partial<Question>)
                    }
                  />
                  {question.kind === 'list' ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="mb-0">Darmowe pomyłki na gracza</Label>
                      <Input
                        className="h-9 w-20"
                        inputMode="numeric"
                        value={question.freeMisses ?? 1}
                        onChange={(event) =>
                          patchQuestion({ freeMisses: Number(event.target.value) || 0 } as Partial<Question>)
                        }
                      />
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-2">
                      <Label className="mb-0">Czas na wymienianie (s)</Label>
                      <Input
                        className="h-9 w-20"
                        inputMode="numeric"
                        value={question.timerSeconds ?? 60}
                        onChange={(event) =>
                          patchQuestion({ timerSeconds: Number(event.target.value) || 60 } as Partial<Question>)
                        }
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {question.kind !== 'wheel' ? (
                <div>
                  <Label>Poprawna odpowiedź (klucz dla prowadzącego)</Label>
                  <Input
                    value={question.answerText ?? ''}
                    onChange={(event) => patchQuestion({ answerText: event.target.value })}
                  />
                </div>
              ) : null}

              <MediaEditor
                label="Multimedia w odpowiedzi"
                value={question.answerMedia}
                onChange={(answerMedia) => patchQuestion({ answerMedia })}
              />

              <div>
                <Label>Notatka dla prowadzącego</Label>
                <Input
                  value={question.notes ?? ''}
                  onChange={(event) => patchQuestion({ notes: event.target.value })}
                />
              </div>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {tab === 'final' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {pack.final.map((item, index) => (
            <Panel key={item.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <PanelTitle>Pytanie finałowe {index + 1}</PanelTitle>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => patchPack({ final: pack.final.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="size-4 text-coral" />
                </Button>
              </div>
              <div>
                <Label>Kategoria (ogłaszana przed obstawianiem)</Label>
                <Input
                  value={item.category}
                  onChange={(event) => patchFinal(index, { category: event.target.value })}
                />
              </div>
              <div>
                <Label>Pytanie otwarte</Label>
                <Textarea
                  rows={2}
                  value={item.prompt}
                  onChange={(event) => patchFinal(index, { prompt: event.target.value })}
                />
              </div>
              <div>
                <Label>Poprawna odpowiedź</Label>
                <Input
                  value={item.answerText}
                  onChange={(event) => patchFinal(index, { answerText: event.target.value })}
                />
              </div>
              <MediaEditor
                label="Multimedia w pytaniu"
                value={item.media}
                onChange={(media) => patchFinal(index, { media })}
              />
              <MediaEditor
                label="Multimedia w odpowiedzi"
                value={item.answerMedia}
                onChange={(answerMedia) => patchFinal(index, { answerMedia })}
              />
            </Panel>
          ))}
          <Button
            variant="secondary"
            className="h-14"
            onClick={() =>
              patchPack({
                final: [
                  ...pack.final,
                  {
                    id: randomId('f'),
                    category: 'Nowa kategoria',
                    prompt: 'Nowe pytanie finałowe',
                    answerText: '',
                  },
                ],
              })
            }
          >
            <Plus className="size-4" /> Dodaj pytanie finałowe
          </Button>
        </div>
      ) : null}

      {tab === 'rules' ? (
        <Panel className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Wartości wierszy (oddzielone przecinkami)</Label>
            <Input
              value={pack.rules.rowValues.join(', ')}
              onChange={(event) =>
                patchPack({
                  rules: {
                    ...pack.rules,
                    rowValues: event.target.value
                      .split(',')
                      .map((value) => Number(value.trim()))
                      .filter((value) => Number.isFinite(value) && value > 0),
                  },
                })
              }
            />
          </div>
          <div>
            <Label>Koszt samogłoski</Label>
            <Input
              inputMode="numeric"
              value={pack.rules.vowelCost}
              onChange={(event) =>
                patchPack({ rules: { ...pack.rules, vowelCost: Number(event.target.value) || 0 } })
              }
            />
          </div>
          <div>
            <Label>Wygrana za 1. miejsce w wyliczance</Label>
            <Input
              inputMode="numeric"
              value={pack.rules.listBasePayout}
              onChange={(event) =>
                patchPack({
                  rules: { ...pack.rules, listBasePayout: Number(event.target.value) || 0 },
                })
              }
            />
          </div>
          <div>
            <Label>O ile mniej za każde kolejne miejsce</Label>
            <Input
              inputMode="numeric"
              value={pack.rules.listPayoutStep}
              onChange={(event) =>
                patchPack({
                  rules: { ...pack.rules, listPayoutStep: Number(event.target.value) || 0 },
                })
              }
            />
            <p className="mt-1 text-xs text-white/45">
              Np. 600 i 200 → 1. miejsce 600, 2. 400, 3. 200, 4. 0, 5. −200 itd.
            </p>
          </div>
          <div>
            <Label>Czas licytacji (s)</Label>
            <Input
              inputMode="numeric"
              value={pack.rules.auctionSeconds}
              onChange={(event) =>
                patchPack({
                  rules: { ...pack.rules, auctionSeconds: Number(event.target.value) || 60 },
                })
              }
            />
          </div>
          <div>
            <Label>Czas na odpowiedź w finale (s)</Label>
            <Input
              inputMode="numeric"
              value={pack.rules.finalAnswerSeconds}
              onChange={(event) =>
                patchPack({
                  rules: { ...pack.rules, finalAnswerSeconds: Number(event.target.value) || 45 },
                })
              }
            />
          </div>
          <div>
            <Label>PIN prowadzącego</Label>
            <Input
              value={pack.rules.hostPin}
              onChange={(event) =>
                patchPack({ rules: { ...pack.rules, hostPin: event.target.value } })
              }
            />
            <p className="mt-1 text-xs text-white/45">
              Wymagany przy wejściu na /admin i /editor — dzięki temu gracze, nawet trafiając na
              ten sam link, nie zobaczą pytań ani panelu prowadzącego. Zostaw puste, żeby wyłączyć
              blokadę.
            </p>
          </div>
        </Panel>
      ) : null}
    </div>
  )
}

function StandardFields({
  question,
  patchQuestion,
}: {
  question: Extract<Question, { kind: 'standard' }>
  patchQuestion: (patch: Partial<Question>) => void
}) {
  const choices = question.choices ?? []
  return (
    <div className="rounded-xl border border-stage-600 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="mb-0">
          {choices.length ? 'Podpowiedzi ABCD' : 'Pytanie otwarte (bez podpowiedzi)'}
        </Label>
        <div className="flex gap-2">
          {choices.length ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => patchQuestion({ choices: [], correctChoiceId: undefined } as Partial<Question>)}
            >
              Zamień na otwarte
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              patchQuestion({
                choices: [...choices, { id: randomId('c'), text: '' }],
              } as Partial<Question>)
            }
          >
            <Plus className="size-4" /> Odpowiedź
          </Button>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-2">
        {choices.map((choice, index) => (
          <div key={choice.id} className="flex flex-col gap-2 rounded-lg border border-stage-700 p-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Oznacz jako poprawną"
                onClick={() => patchQuestion({ correctChoiceId: choice.id } as Partial<Question>)}
              >
                {question.correctChoiceId === choice.id ? (
                  <CheckCircle2 className="size-5 text-mint" />
                ) : (
                  <Circle className="size-5 text-white/30" />
                )}
              </button>
              <span className="text-display w-4 text-gold">
                {String.fromCharCode(65 + index)}
              </span>
              <Input
                value={choice.text}
                onChange={(event) =>
                  patchQuestion({
                    choices: choices.map((item, i) =>
                      i === index ? { ...item, text: event.target.value } : item,
                    ),
                  } as Partial<Question>)
                }
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() =>
                  patchQuestion({
                    choices: choices.filter((_, i) => i !== index),
                  } as Partial<Question>)
                }
              >
                <Trash2 className="size-4 text-coral" />
              </Button>
            </div>
            <MediaEditor
              label="Multimedia w odpowiedzi"
              value={choice.media}
              onChange={(media) =>
                patchQuestion({
                  choices: choices.map((item, i) => (i === index ? { ...item, media } : item)),
                } as Partial<Question>)
              }
            />
          </div>
        ))}
        {choices.length === 0 ? (
          <p className="text-sm text-white/50">
            Bez podpowiedzi gracz wpisuje odpowiedź na telefonie lub mówi ją na głos — prowadzący
            ocenia ręcznie.
          </p>
        ) : null}
      </div>
    </div>
  )
}
