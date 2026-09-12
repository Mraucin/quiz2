import { useEffect, useState } from 'react'

/** Re-renders on an interval so countdowns stay live. */
export function useTicker(active: boolean, intervalMs = 250) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setTick((t) => t + 1), intervalMs)
    return () => window.clearInterval(id)
  }, [active, intervalMs])
}

/** Difference between this device's clock and the host's, so countdowns match. */
export function clockSkew(state: { now: number }) {
  return state.now ? Date.now() - state.now : 0
}

export function secondsLeft(endsAt: number | null | undefined, skewMs = 0) {
  if (!endsAt) return null
  return Math.max(0, Math.ceil((endsAt - (Date.now() - skewMs)) / 1000))
}
