import { useState, type ReactNode } from 'react'
import { ArrowLeft, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Panel, PanelTitle } from '@/components/ui/primitives'
import type { Pack } from '@/lib/types'

const UNLOCK_KEY = 'jeopardy-twist:host-pin-ok'

function rememberedPin(): string | null {
  try {
    return localStorage.getItem(UNLOCK_KEY)
  } catch {
    return null
  }
}

function rememberPin(pin: string) {
  try {
    localStorage.setItem(UNLOCK_KEY, pin)
  } catch {
    /* storage disabled — will just ask again next time */
  }
}

/**
 * Blocks /admin and /editor behind the pack's PIN so a player who lands on the same site
 * (e.g. by stripping the hash from the join link, or by guessing the URL) can't see the
 * question bank, answer keys, or the game master's controls. Not real security — the PIN
 * lives in the pack itself and anyone with dev tools could read it — but it stops casual,
 * accidental discovery, which is the actual risk at a party.
 *
 * Deliberately mounts `children` only once unlocked, so the wrapped screen's hooks
 * (e.g. `useHostGame`, which opens a PeerJS host connection) never run for someone who
 * hasn't entered the PIN.
 */
export function HostGate({
  pack,
  navigate,
  children,
}: {
  pack: Pack
  navigate: (path: string) => void
  children: ReactNode
}) {
  const pin = pack.rules.hostPin ?? ''
  const [unlocked, setUnlocked] = useState(() => !pin || rememberedPin() === pin)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  if (unlocked) return <>{children}</>

  return (
    <div className="grid min-h-screen place-items-center p-5">
      <Panel className="flex w-full max-w-sm flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Menu główne">
            <ArrowLeft className="size-4" />
          </Button>
          <PanelTitle>
            <Lock className="mr-1 inline size-4" /> Dostęp dla prowadzącego
          </PanelTitle>
        </div>
        <p className="text-sm text-white/60">
          Ten widok jest tylko dla prowadzącego — podaj PIN, żeby zobaczyć pytania, klucze
          odpowiedzi i panel gry.
        </p>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (value === pin) {
              rememberPin(pin)
              setUnlocked(true)
              setError(false)
            } else {
              setError(true)
            }
          }}
        >
          <Input
            autoFocus
            inputMode="numeric"
            placeholder="PIN prowadzącego"
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setError(false)
            }}
          />
          {error ? <p className="text-xs text-coral">Zły PIN, spróbuj jeszcze raz.</p> : null}
          <Button type="submit" variant="primary">
            Wejdź
          </Button>
        </form>
      </Panel>
    </div>
  )
}
