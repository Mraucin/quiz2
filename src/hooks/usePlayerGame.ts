import { useCallback, useEffect, useRef, useState } from 'react'
import { connectToHost, type ClientNet } from '@/lib/net'
import { recallPlayer, rememberPlayer } from '@/lib/storage'
import type { GameState, PlayerAction } from '@/lib/types'

export type JoinStatus = 'idle' | 'connecting' | 'reconnecting' | 'joined' | 'error'

/** How often a joined client tells the host it's still alive (see the heartbeat check in useHostGame.ts). */
const PING_INTERVAL_MS = 8000
/** Reconnect backoff ceiling — doubles from 1s up to this, then holds steady. */
const MAX_RECONNECT_DELAY_MS = 8000
/** Don't resend 'join' more than this often while self-healing (see below). */
const SELF_HEAL_INTERVAL_MS = 5000

export function usePlayerGame() {
  const [status, setStatus] = useState<JoinStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [transport, setTransport] = useState<'local' | 'peer' | null>(null)
  const netRef = useRef<ClientNet | null>(null)
  const pingTimerRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const destroyedRef = useRef(false)
  const playerIdRef = useRef<string | null>(null)
  const lastSelfHealAtRef = useRef(0)

  // Mirrors `status` for code that runs inside callbacks set up once per connection attempt
  // (onMessage/onClose below) — those close over whatever `status` was at setup time, which
  // goes stale the moment React re-renders, so anything that needs the *current* status reads
  // this ref instead.
  const statusRef = useRef<JoinStatus>('idle')
  const setStatusBoth = (next: JoinStatus) => {
    statusRef.current = next
    setStatus(next)
  }

  // What to silently rejoin with if the connection drops for any reason — a flaky network, or
  // the host's tab reloading. Set once on the first manual `join()` call.
  const sessionRef = useRef<{ code: string; name: string; avatar: string } | null>(null)

  // Tracks the playerId we've successfully joined as *in this session*, per room code. Using
  // this (rather than only the value read from localStorage once at mount) is what makes a
  // retry safe: if the connection drops and we reconnect without a full page reload, this ref
  // already has the right id, so the host resumes our existing seat instead of creating a
  // second player for us.
  const lastJoinRef = useRef<{ code: string; playerId: string } | null>(null)

  const stopPing = () => {
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current)
      pingTimerRef.current = null
    }
  }

  const startPing = () => {
    stopPing()
    pingTimerRef.current = window.setInterval(() => {
      netRef.current?.send({ type: 'ping' })
    }, PING_INTERVAL_MS)
  }

  useEffect(
    () => () => {
      destroyedRef.current = true
      stopPing()
      if (reconnectTimerRef.current !== null) window.clearTimeout(reconnectTimerRef.current)
      netRef.current?.destroy()
      netRef.current = null
    },
    [],
  )

  function scheduleReconnect(message: string) {
    if (destroyedRef.current) return
    const session = sessionRef.current
    if (!session) {
      setStatusBoth('error')
      setError(message)
      return
    }
    setStatusBoth('reconnecting')
    setError(message)
    stopPing()
    reconnectAttemptRef.current += 1
    const delay = Math.min(1000 * 2 ** (reconnectAttemptRef.current - 1), MAX_RECONNECT_DELAY_MS)
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null
      void connect(session.code, session.name, session.avatar)
    }, delay)
  }

  async function connect(code: string, name: string, avatar: string) {
    const upper = code.toUpperCase()
    const remembered = recallPlayer()
    const resumeId =
      (lastJoinRef.current?.code === upper ? lastJoinRef.current.playerId : undefined) ??
      (remembered?.code === upper ? remembered.playerId : undefined)
    // Whether we've ever actually joined *this* room code before — not just some other room
    // from an earlier attempt. Only then is it safe to retry a drop silently in the
    // background; otherwise (e.g. someone typed a fresh, wrong code right after leaving a
    // previous game) a closed connection should surface immediately instead of quietly
    // hammering a room that was never real.
    const hasJoinedThisCode = lastJoinRef.current?.code === upper
    netRef.current?.destroy()
    netRef.current = null
    try {
      const net = await connectToHost(upper, {
        onMessage: (message) => {
          if (message.type === 'state') {
            setState(message.state)
            // If the host thinks we're disconnected while we believe we're happily joined —
            // most likely it restarted and forgot our seat (same-browser tabs never see a
            // clean transport 'close' for that), or a heartbeat timeout fired while we were
            // briefly backgrounded — quietly resend 'join' to reclaim our spot rather than
            // waiting for an explicit drop that may never come.
            const myId = playerIdRef.current
            const me = myId ? message.state.players.find((p) => p.id === myId) : null
            if (me && !me.connected && statusRef.current === 'joined') {
              const now = Date.now()
              if (now - lastSelfHealAtRef.current > SELF_HEAL_INTERVAL_MS) {
                lastSelfHealAtRef.current = now
                netRef.current?.send({ type: 'join', name, avatar, resumeId: me.id })
              }
            }
          }
          if (message.type === 'welcome') {
            lastJoinRef.current = { code: upper, playerId: message.playerId }
            playerIdRef.current = message.playerId
            setPlayerId(message.playerId)
            setState(message.state)
            setStatusBoth('joined')
            setError(null)
            reconnectAttemptRef.current = 0
            rememberPlayer(upper, message.playerId, name, avatar)
            startPing()
          }
          if (message.type === 'rejected') setError(message.reason)
        },
        onClose: () => {
          if (destroyedRef.current) return
          netRef.current = null
          stopPing()
          // Never actually finished joining this code before this connection died — don't
          // loop silently on what might be a bad code or a host that never existed; surface it
          // and let the person retry by hand, same as a synchronous connect failure would.
          if (!hasJoinedThisCode) {
            setStatusBoth('error')
            setError('Połączenie z hostem zostało przerwane, zanim udało się dołączyć. Spróbuj ponownie.')
            return
          }
          scheduleReconnect(
            'Połączenie z hostem zostało przerwane. Łączę ponownie — Twoje miejsce w grze zostanie zachowane.',
          )
        },
      })
      if (destroyedRef.current) {
        net.destroy()
        return
      }
      netRef.current = net
      setTransport(net.transport)
      net.send({ type: 'join', name, avatar, resumeId })
    } catch (caught) {
      if (destroyedRef.current) return
      const message = caught instanceof Error ? caught.message : 'Nie udało się połączyć.'
      // First attempt at this code: surface the error and let the person retry by hand (maybe
      // they typed the wrong code). Once we've joined this exact room before, keep quietly
      // retrying in the background instead — most drops (like the host's tab reloading)
      // resolve themselves within a few seconds.
      if (!hasJoinedThisCode) {
        setStatusBoth('error')
        setError(message)
      } else {
        scheduleReconnect(message)
      }
    }
  }

  const join = useCallback((code: string, name: string, avatar: string) => {
    if (reconnectTimerRef.current !== null) {
      window.clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    reconnectAttemptRef.current = 0
    setStatusBoth('connecting')
    setError(null)
    sessionRef.current = { code, name, avatar }
    void connect(code, name, avatar)
  }, [])

  const send = useCallback((action: PlayerAction) => {
    netRef.current?.send({ type: 'action', action })
  }, [])

  const me = state?.players.find((p) => p.id === playerId) ?? null

  return { status, error, state, playerId, me, transport, join, send }
}
