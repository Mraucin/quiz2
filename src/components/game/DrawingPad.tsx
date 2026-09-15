import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Point = [number, number]
type Stroke = Point[]

const VIEW_W = 600
const VIEW_H = 400
/** Punkty bliższe niż to (w jednostkach viewBoxa) są pomijane — szkic zostaje płynny, ale bez
 * setek prawie-identycznych punktów z każdego zdarzenia `pointermove`. */
const MIN_POINT_GAP = 3

function serializeStrokes(strokes: Stroke[]): string {
  return strokes.length ? JSON.stringify(strokes) : ''
}

function parseStrokes(value?: string): Stroke[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parsed as Stroke[]
  } catch {
    // Stare/nieoczekiwane dane (np. zwykły tekst sprzed wprowadzenia rysowanego panelu) — po
    // prostu nic nie rysujemy zamiast wywalać całą apkę.
  }
  return []
}

/**
 * Odręczny "rysowany panel" do finałowych odpowiedzi — zamiast wpisywać tekst z klawiatury,
 * gracz pisze/rysuje palcem po ekranie telefonu (bardziej "na żywo", widać charakter pisma).
 * Serializuje się do kompaktowego JSON-a punktów (tablica kresek, każda to lista [x,y]), NIE do
 * rastrowego PNG — nawet długa odpowiedź to zwykle kilka KB w pełnym broadcastcie stanu gry.
 *
 * `onChange` odpala się dopiero po zakończeniu każdej kreski (puszczenie palca/myszy), nigdy w
 * trakcie ruchu — wywołujący (np. `Play.tsx`) i tak wysyła to do hosta dopiero po kliknięciu
 * „Wysyłam”, więc to tylko lokalna aktualizacja stanu, bez zalewania kanału WebRTC.
 */
export function DrawingPad({
  value,
  onChange,
  editable = false,
  resetKey,
  className,
  emptyLabel = '— brak odpowiedzi —',
}: {
  /** Zserializowana treść do pokazania w trybie tylko-do-odczytu (podgląd cudzej odpowiedzi). */
  value?: string
  /** Wywoływane z nową zserializowaną treścią po każdej zakończonej kresce (tylko gdy `editable`). */
  onChange?: (value: string) => void
  editable?: boolean
  /** Zmiana tej wartości czyści szkic — użyj np. `final.index`, żeby nie zostały kreski z
   * poprzedniego pytania finałowego. */
  resetKey?: string | number
  /** Nadpisuje rozmiar/proporcje panelu (np. `"h-16 w-40"` na mały podgląd) — domyślnie
   * `aspect-[3/2] w-full`, czyli proporcje 600×400 z viewBoxa, szerokość na całą dostępną. */
  className?: string
  emptyLabel?: string
}) {
  const [strokes, setStrokes] = useState<Stroke[]>(() => parseStrokes(value))
  const svgRef = useRef<SVGSVGElement>(null)
  const drawingRef = useRef(false)

  // Tryb podglądu (nieedytowalny) zawsze odzwierciedla to, co faktycznie przyszło z sieci.
  useEffect(() => {
    if (!editable) setStrokes(parseStrokes(value))
  }, [editable, value])

  // Nowe pytanie finałowe (albo inny sygnał od wywołującego) — czyścimy lokalny szkic i
  // informujemy wywołującego, żeby jego draft też nie trzymał treści z poprzedniego pytania.
  // Celowo reaguje TYLKO na zmianę `resetKey`, nie na `editable`/`onChange`.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editable) return
    setStrokes([])
    onChange?.('')
  }, [resetKey])

  // Zależy na `preserveAspectRatio="none"` na <svg> niżej: bez tego SVG domyślnie skaluje
  // viewBox proporcjonalnie i dokleja "czarne pasy" (letterboxing), gdy pudełko nie ma
  // dokładnie proporcji viewBoxa (600:400) — a to liczenie zakłada, że viewBox rozciąga się
  // na CAŁY `rect`. Bez `none` powodowało to dokładnie ten bug: kreska "uciekała" spod
  // kursora tym bardziej, im dalej od środka się rysowało.
  const toPoint = (clientX: number, clientY: number): Point => {
    const svg = svgRef.current
    if (!svg) return [0, 0]
    const rect = svg.getBoundingClientRect()
    const x = Math.round(((clientX - rect.left) / rect.width) * VIEW_W)
    const y = Math.round(((clientY - rect.top) / rect.height) * VIEW_H)
    return [x, y]
  }

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!editable) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawingRef.current = true
    setStrokes((prev) => [...prev, [toPoint(event.clientX, event.clientY)]])
  }

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!editable || !drawingRef.current) return
    const point = toPoint(event.clientX, event.clientY)
    setStrokes((prev) => {
      if (prev.length === 0) return prev
      const last = prev[prev.length - 1]
      const lastPoint = last[last.length - 1]
      if (lastPoint) {
        const dx = point[0] - lastPoint[0]
        const dy = point[1] - lastPoint[1]
        if (dx * dx + dy * dy < MIN_POINT_GAP * MIN_POINT_GAP) return prev
      }
      const next = prev.slice(0, -1)
      next.push([...last, point])
      return next
    })
  }

  const endStroke = () => {
    if (!editable || !drawingRef.current) return
    drawingRef.current = false
    setStrokes((current) => {
      onChange?.(serializeStrokes(current))
      return current
    })
  }

  const clear = () => {
    setStrokes([])
    onChange?.('')
  }

  const isEmpty = strokes.length === 0

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(
          // Domyślnie proporcje 3:2 (= 600×400 z viewBoxa) — wysokość sama dopasowuje się do
          // szerokości, więc panel jest wyraźnie wyższy niż był (poprzednio 600×240, "szeroki
          // ale niewysoki"). Wywołujący może nadpisać przez `className`, jeśli potrzebuje
          // innego rozmiaru (np. mały podgląd obok przycisków).
          'relative aspect-[3/2] w-full overflow-hidden rounded-card border border-stage-600 bg-black/30',
          className,
        )}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          className={cn('block h-full w-full text-white', editable && 'touch-none cursor-crosshair')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endStroke}
          onPointerLeave={endStroke}
          onPointerCancel={endStroke}
        >
          {strokes.map((stroke, index) => (
            <polyline
              key={index}
              points={stroke.map(([x, y]) => `${x},${y}`).join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth={7}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
        {isEmpty ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-center text-sm text-white/30">
            {editable ? 'Pisz / rysuj palcem tutaj…' : emptyLabel}
          </div>
        ) : null}
      </div>
      {editable ? (
        <Button size="sm" variant="secondary" type="button" onClick={clear} disabled={isEmpty}>
          <RotateCcw className="size-4" /> Wyczyść
        </Button>
      ) : null}
    </div>
  )
}
