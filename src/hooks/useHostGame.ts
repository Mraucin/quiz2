import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { applyAction, createInitialState, joinPlayer, setConnected } from '@/lib/engine'
import { createHost, type HostNet, type PeerStatus } from '@/lib/net'
import type { AdminAction, GameState, Pack, PlayerAction } from '@/lib/types'
import { roomCode } from '@/lib/utils'

const CODE_KEY = 'jeopardy-twist:code'
const STATE_KEY = 'jeopardy-twist:host-state'

/** Keeps a running game alive across an accidental reload of the host tab. */
function restoreState(code: string): GameState | null {
  try {
    const raw = sessionStorage.getItem(STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    if (parsed.code !== code || !Array.isArray(parsed.players)) return null
    // Sockets died with the old tab; phones reconnect on their own.
    parsed.players = parsed.players.map((player) =>
      player.local ? player : { ...player, connected: false },
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

  useEffect(() => {
    packRef.current = pack
  }, [pack])

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
        const current = stateRef.current
        const currentPack = packRef.current
        if (!current || !currentPack) return
        if (message.type === 'join') {
          const knownId = seats.current.get(connId) ?? message.resumeId
          const known = knownId ? current.players.find((p) => p.id === knownId) : null
          const result = joinPlayer(current, {
            playerId: known?.id,
            name: message.name,
            avatar: message.avatar,
          })
          seats.current.set(connId, result.playerId)
          commit(result.state)
          net.send(connId, { type: 'welcome', playerId: result.playerId, state: result.state })
          return
        }
        if (message.type === 'action') {
          const playerId = seats.current.get(connId)
          if (!playerId) {
            net.send(connId, { type: 'rejected', reason: 'Dołącz do gry ponownie.' })
            return
          }
          commit(
            applyAction(currentPack, current, {
              source: 'player',
              playerId,
              action: message.action as PlayerAction,
            }),
          )
        }
      },
      onDisconnect: (connId) => {
        const playerId = seats.current.get(connId)
        const current = stateRef.current
        if (!playerId || !current) return
        seats.current.delete(connId)
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

  const joinUrl = useMemo(() => {
    const base = `${window.location.origin}${window.location.pathname}`
    return `${base}#/play?code=${code}`
  }, [code])

  return { code, state, dispatch, dispatchAs, peerStatus, peerDetail, joinUrl }
}
