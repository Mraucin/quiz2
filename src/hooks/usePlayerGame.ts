import { useCallback, useEffect, useRef, useState } from 'react'
import { connectToHost, type ClientNet } from '@/lib/net'
import { rememberPlayer } from '@/lib/storage'
import type { GameState, PlayerAction } from '@/lib/types'

export type JoinStatus = 'idle' | 'connecting' | 'joined' | 'error'

export function usePlayerGame() {
  const [status, setStatus] = useState<JoinStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<GameState | null>(null)
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [transport, setTransport] = useState<'local' | 'peer' | null>(null)
  const netRef = useRef<ClientNet | null>(null)

  useEffect(
    () => () => {
      netRef.current?.destroy()
      netRef.current = null
    },
    [],
  )

  const join = useCallback(
    async (code: string, name: string, avatar: string, resumeId?: string) => {
      setStatus('connecting')
      setError(null)
      netRef.current?.destroy()
      try {
        const net = await connectToHost(code, {
          onMessage: (message) => {
            if (message.type === 'state') setState(message.state)
            if (message.type === 'welcome') {
              setPlayerId(message.playerId)
              setState(message.state)
              setStatus('joined')
              rememberPlayer(code.toUpperCase(), message.playerId, name, avatar)
            }
            if (message.type === 'rejected') setError(message.reason)
          },
          onClose: () => {
            setStatus('error')
            setError('Połączenie z hostem zostało przerwane. Odśwież stronę, aby wrócić do gry.')
          },
        })
        netRef.current = net
        setTransport(net.transport)
        net.send({ type: 'join', name, avatar, resumeId })
      } catch (caught) {
        setStatus('error')
        setError(caught instanceof Error ? caught.message : 'Nie udało się połączyć.')
      }
    },
    [],
  )

  const send = useCallback((action: PlayerAction) => {
    netRef.current?.send({ type: 'action', action })
  }, [])

  const me = state?.players.find((p) => p.id === playerId) ?? null

  return { status, error, state, playerId, me, transport, join, send }
}
