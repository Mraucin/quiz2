import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyAction, buildMediaBundle, createInitialState, joinPlayer, setConnected } from '@/lib/engine'
import { createHost, type HostNet, type PeerStatus } from '@/lib/net'
import type { AdminAction, GameState, MediaBundleItem, Pack, PlayerAction } from '@/lib/types'
import { roomCode } from '@/lib/utils'

const CODE_KEY = 'jeopardy-twist:code'
const STATE_KEY = 'jeopardy-twist:host-state'

/**
 * A connection that hasn't sent us anything — not even a `ping` — in this long is treated as
 * gone, even if its transport never fired a clean close/error event. Comfortably more than
 * twice the player-side ping interval (see `usePlayerGame.ts`) so ordinary network jitter
 * doesn't trip it.
 */
const HEARTBEAT_TIMEOUT_MS = 20_000

/**
 * How long a disconnected player can hold up Koło fortuny before the admin ends up in the
 * "they went to the bathroom" trap and everyone else just waits. Mirrors the manual
 * "Kolejka dalej" button (`wheelPassTurn`), just triggered automatically.
 */
const WHEEL_DISCONNECT_SKIP_MS = 30_000

/** Keeps a running game alive across an accidental reload of the host tab. */
function restoreState(code: string): GameState | null {
  try {
    const raw = sessionStorage.getItem(STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    if (parsed.code !== code || !Array.isArray(parsed.players)) return null
    // Sockets died with the old tab; phones (and other tabs) reconnect on their own — see the
    // auto-reconnect + heartbeat self-heal in usePlayerGame.ts.
    parsed.players = parsed.players.map((player) =>
      player.local ? player : { ...player, connected: false, disconnectedAt: player.disconnectedAt ?? Date.now() },
    )
    return parsed
  } catch {
    return null
  }
}

function initialCode() {
  try {
    const stored = sessionStorage.getItem(CODE_KEY)
    if (stored) return stored
  } catch {
    /* ignore */
  }
  const code = roomCode()
  try {
    sessionStorage.setItem(CODE_KEY, code)
  } catch {
    /* ignore */
  }
  return code
}

export function useHostGame(pack: Pack | null) {
  const [code] = useState(initialCode)
  const [state, setState] = useState<GameState | null>(null)
  const [peerStatus, setPeerStatus] = useState<PeerStatus>('connecting')
  const [peerDetail, setPeerDetail] = useState<string | null>(null)
  const stateRef = useRef<GameState | null>(null)
  const packRef = useRef<Pack | null>(pack)
  const netRef = useRef<HostNet | null>(null)
  /** connection id -> player id */
  const seats = useRef(new Map<string, string>())
  /** connection id -> last time we heard *anything* from it (join, action, or a bare ping). */
  const lastSeen = useRef(new Map<string, number>())
  // Every local media file in the pack, built once per pack (not per join) — sent to each
  // player right after they join so playback never has to wait on a transfer later. A ref
  // (not just the memo) because the join handler below is set up once and needs the latest
  // value without re-subscribing.
  const mediaBundle = useMemo(() => (pack ? buildMediaBundle(pack) : []), [pack])
  const mediaBundleRef = useRef<MediaBundleItem[]>(mediaBundle)

  useEffect(() => {
    packRef.current = pack
  }, [pack])

  useEffect(() => {
    mediaBundleRef.current = mediaBundle
  }, [mediaBundle])

  const commit = useCallback((next: GameState) => {
    next.now = Date.now()
    stateRef.current = next
    setState(next)
    netRef.current?.broadcast({ type: 'state', state: next })
    try {
      sessionStorage.setItem(STATE_KEY, JSON.stringify(next))
    } catch {
      /* storage full or disabled — the game keeps running in memory */
    }
  }, [])

  useEffect(() => {
    if (!pack || stateRef.current) return
    const restored = restoreState(code)
    const fresh = restored ?? createInitialState(pack, code)
    stateRef.current = fresh
    setState(fresh)
  }, [pack, code])

  useEffect(() => {
    if (!pack) return
    const net = createHost(code, {
      onStatus: (status, detail) => {
        setPeerStatus(status)
        setPeerDetail(detail ?? null)
      },
      onMessage: (connId, message) => {
        let current = stateRef.current
        const currentPack = packRef.current
        if (!current || !currentPack) return
        // Any message at all — including a bare 'ping' — means this connection is alive.
        lastSeen.current.set(connId, Date.now())

        if (message.type === 'join') {
          const knownId = seats.current.get(connId) ?? message.resumeId
          const known = knownId ? current.players.find((p) => p.id === knownId) : null
          const result = joinPlayer(current, {
            playerId: known?.id,
            name: message.name,
            avatar: message.avatar,
          })
          // A reconnect can land before the old connection's belated `close` event does —
          // e.g. a phone drops wifi, reopens the tab, and rejoins while the dead socket is
          // still winding down. Drop any other seat already pointing at this player so that
          // late `close` event (handled below in onDisconnect) can't flip them back to
          // "disconnected" right after they've just rejoined, and so it never creates a second
          // seat for the same person.
          for (const [otherConnId, otherPlayerId] of seats.current) {
            if (otherPlayerId === result.playerId && otherConnId !== connId) {
              seats.current.delete(otherConnId)
              lastSeen.current.delete(otherConnId)
            }
          }
          seats.current.set(connId, result.playerId)
          commit(result.state)
          net.send(connId, { type: 'welcome', playerId: result.playerId, state: result.state })
          if (mediaBundleRef.current.length) {
            net.send(connId, { type: 'mediaBundle', items: mediaBundleRef.current })
          }
          return
        }

        // A message from an already-seated connection means they're still here. If the
        // heartbeat monitor (below) had marked them disconnected in the meantime — their
        // phone was backgrounded for a bit and missed a few pings, say — quietly restore
        // "connected" instead of making them go through a full rejoin.
        const seatedPlayerId = seats.current.get(connId)
        if (seatedPlayerId) {
          const player = current.players.find((p) => p.id === seatedPlayerId)
          if (player && !player.connected) {
            current = setConnected(current, seatedPlayerId, true)
            commit(current)
          }
        }

        if (message.type === 'action') {
          if (!seatedPlayerId) {
            net.send(connId, { type: 'rejected', reason: 'Dołącz do gry ponownie.' })
            return
          }
          commit(
            applyAction(currentPack, current, {
              source: 'player',
              playerId: seatedPlayerId,
              action: message.action as PlayerAction,
            }),
          )
          return
        }
        // message.type === 'ping' -> nothing further to do, lastSeen was already bumped above.
      },
      onDisconnect: (connId) => {
        const playerId = seats.current.get(connId)
        const current = stateRef.current
        seats.current.delete(connId)
        lastSeen.current.delete(connId)
        if (!playerId || !current) return
        commit(setConnected(current, playerId, false))
      },
    })
    netRef.current = net
    return () => {
      net.destroy()
      netRef.current = null
    }
  }, [pack, code, commit])

  const dispatch = useCallback(
    (action: AdminAction) => {
      const current = stateRef.current
      const currentPack = packRef.current
      if (!current || !currentPack) return
      commit(applyAction(currentPack, current, { source: 'admin', action }))
    },
    [commit],
  )

  /** Acts on behalf of a hot-seat player from the admin console. */
  const dispatchAs = useCallback(
    (playerId: string, action: PlayerAction) => {
      const current = stateRef.current
      const currentPack = packRef.current
      if (!current || !currentPack) return
      commit(applyAction(currentPack, current, { source: 'player', playerId, action }))
    },
    [commit],
  )

  // Periodic maintenance: catch connections that went silent without a clean close/error
  // event, and don't let a Koło fortuny turn stall forever on someone who's been gone a while.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now()

      for (const [connId, playerId] of seats.current) {
        const seenAt = lastSeen.current.get(connId)
        if (seenAt !== undefined && now - seenAt <= HEARTBEAT_TIMEOUT_MS) continue
        const latest = stateRef.current
        const player = latest?.players.find((p) => p.id === playerId)
        if (!latest || !player || player.local || !player.connected) continue
        commit(setConnected(latest, playerId, false))
      }

      const current = stateRef.current
      const wheel = current?.active?.wheel
      if (current && wheel?.turnPlayerId) {
        const turnPlayer = current.players.find((p) => p.id === wheel.turnPlayerId)
        if (
          turnPlayer &&
          !turnPlayer.local &&
          !turnPlayer.connected &&
          turnPlayer.disconnectedAt &&
          now - turnPlayer.disconnectedAt >= WHEEL_DISCONNECT_SKIP_MS
        ) {
          dispatch({ type: 'wheelPassTurn' })
        }
      }
    }, 5000)
    return () => window.clearInterval(interval)
  }, [commit, dispatch])

  const joinUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`
    return `${base}#/play?code=${code}`
  }, [code])

  return { code, state, dispatch, dispatchAs, peerStatus, peerDetail, joinUrl }
}
