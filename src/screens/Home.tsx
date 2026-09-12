import { useState } from 'react'
import { Gamepad2, Gavel, ListChecks, Mic2, Pencil, Radio, RotateCcw, Sparkles, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Panel, PanelTitle } from '@/components/ui/primitives'
import { Wheel } from '@/components/game/Wheel'
import type { Pack } from '@/lib/types'
import { cellValue } from '@/lib/engine'
import { WHEEL_SEGMENTS } from '@/lib/defaultPack'
import { formatPoints } from '@/lib/utils'

const twists = [
  {
    icon: Radio,
    title: 'Kategoria audio',
    text: 'Pytania z nagraniem albo lektorem — prowadzący puszcza dźwięk z ekranu głównego.',
  },
  {
    icon: Sparkles,
    title: 'Koło fortuny',
    text: 'Hasło z zasłoniętymi literami, kręcenie kołem, spółgłoski do puli i samogłoski na zakup.',
  },
  {
    icon: ListChecks,
    title: 'Wyliż chunka',
    text: 'Wyliczanka na przemian, jedna pomyłka za darmo. Pierwszy bierze pulę, drugi połowę, dalsi minus.',
  },
  {
    icon: Gavel,
    title: 'Licytacje',
    text: 'Podbijasz, ile odpowiedzi wymienisz. Admin zatrzymuje licytację i odlicza czas.',
  },
  {
    icon: Trophy,
    title: 'Finał z obstawianiem',
    text: 'Sześć pytań otwartych: najpierw kategoria i zakład, potem odpowiedzi odkrywane na forum.',
  },
]

export function HomeScreen({ pack, navigate }: { pack: Pack; navigate: (path: string) => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 p-5 sm:p-8">
      <header className="flex flex-col items-center gap-3 pt-6 text-center">
        <Badge tone="gold" className="tracking-[0.25em] uppercase">
          Teleturniej imprezowy
        </Badge>
        <h1 className="text-display text-5xl leading-none text-gold sm:text-7xl">
          Jeopardy z twistem
        </h1>
        <p className="max-w-2xl text-white/65">
          Plansza z {pack.categories.length} kategoriami po 6 pytań, gracze dołączają telefonami do
          lobby, a prowadzący sędziuje wszystko z własnego panelu. Koło fortuny, licytacje,
          wyliczanka i finał z obstawianiem w komplecie.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel className="flex flex-col gap-3">
          <PanelTitle>
            <Mic2 className="mr-1 inline size-4" /> Prowadzący
          </PanelTitle>
          <p className="flex-1 text-sm text-white/60">
            Otwórz studio, pokaż kod pokoju na dużym ekranie i sędziuj odpowiedzi. Tu widzisz klucze,
            listy odpowiedzi i wszystkie punkty.
          </p>
          <Button variant="primary" size="lg" onClick={() => navigate('/admin')}>
            <Gamepad2 className="size-5" /> Prowadź grę
          </Button>
        </Panel>
        <Panel className="flex flex-col gap-3">
          <PanelTitle>Gracz</PanelTitle>
          <p className="flex-1 text-sm text-white/60">
            Wpisz kod pokoju, wybierz nick i ikonę. Telefon staje się przyciskiem do zgłoszeń,
            licytacji i obstawiania w finale.
          </p>
          <Button variant="secondary" size="lg" onClick={() => navigate('/play')}>
            Dołącz do lobby
          </Button>
        </Panel>
        <Panel className="flex flex-col gap-3">
          <PanelTitle>Edytor</PanelTitle>
          <p className="flex-1 text-sm text-white/60">
            Podmień pytania, dodaj zdjęcia, audio i wideo, ustaw podpowiedzi albo pytania otwarte.
            Pakiet zapisuje się w przeglądarce i da się wyeksportować.
          </p>
          <Button variant="secondary" size="lg" onClick={() => navigate('/editor')}>
            <Pencil className="size-5" /> Edytuj pytania
          </Button>
        </Panel>
      </div>

      <Panel>
        <PanelTitle>Plansza w tym pakiecie</PanelTitle>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pack.categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-2 rounded-xl border border-stage-600 px-3 py-2"
            >
              <span className="flex-1 truncate text-sm font-semibold">{category.name}</span>
              {category.fixedValue == null && category.multiplier !== 1 ? (
                <Badge tone={category.multiplier > 1 ? 'mint' : 'coral'}>×{category.multiplier}</Badge>
              ) : null}
              <span className="text-display text-xs text-gold">
                {category.fixedValue != null
                  ? formatPoints(category.fixedValue)
                  : `${formatPoints(cellValue(pack, category, 0))}–${formatPoints(
                      cellValue(pack, category, category.questions.length - 1),
                    )}`}
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <WheelTester />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {twists.map((twist) => (
          <Panel key={twist.title} className="flex gap-3">
            <twist.icon className="mt-0.5 size-5 shrink-0 text-gold" />
            <div>
              <div className="font-semibold">{twist.title}</div>
              <p className="text-sm text-white/60">{twist.text}</p>
            </div>
          </Panel>
        ))}
      </div>

      <footer className="pb-6 text-center text-xs text-white/40">
        Działa w całości w przeglądarce — hostowane na GitHub Pages, połączenia peer-to-peer przez
        WebRTC.
      </footer>
    </div>
  )
}

type WheelResult = { label: string; value: number; bankrupt?: boolean }

/**
 * Standalone spin tester — no lobby, no players, no game state. Lets you eyeball whether the
 * wheel spins evenly around its own hub, lands cleanly under the pointer, and keeps every label
 * (including the stacked BANKRUT) readable, without setting up a full match first.
 */
function WheelTester() {
  const [nonce, setNonce] = useState(0)
  const [index, setIndex] = useState(0)
  const [history, setHistory] = useState<WheelResult[]>([])

  const spin = () => {
    const next = Math.floor(Math.random() * WHEEL_SEGMENTS.length)
    setIndex(next)
    setNonce((n) => n + 1)
    setHistory((h) => [WHEEL_SEGMENTS[next], ...h].slice(0, 8))
  }

  const last = history[0]

  return (
    <Panel className="flex flex-col items-center gap-4">
      <PanelTitle>Testuj koło fortuny</PanelTitle>
      <p className="max-w-md text-center text-sm text-white/60">
        Osobny podgląd koła, bez zakładania lobby — sprawdź czy kręci się równo wokół środka, czy
        trafia dokładnie pod wskaźnik i czy litery (też „BANKRUT” w pionie) są czytelne po
        zatrzymaniu.
      </p>
      <Wheel index={index} nonce={nonce} size={240} />
      <Button variant="primary" size="lg" onClick={spin}>
        <RotateCcw className="size-5" /> Zakręć testowo
      </Button>
      {last ? (
        <div className="text-display text-2xl text-gold">
          {last.bankrupt ? 'BANKRUT' : formatPoints(last.value)}
        </div>
      ) : null}
      {history.length > 1 ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {history.slice(1).map((seg, i) => (
            <Badge key={i} tone={seg.bankrupt ? 'coral' : 'neutral'}>
              {seg.bankrupt ? 'BANKRUT' : formatPoints(seg.value)}
            </Badge>
          ))}
        </div>
      ) : null}
    </Panel>
  )
}
