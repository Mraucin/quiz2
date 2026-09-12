import type { DataConnection, Peer as PeerType } from 'peerjs'
import type { ClientMessage, HostMessage } from './types'
import { randomId } from './utils'

/**
 * Two transports run side by side so the game works in every setting:
 *  - PeerJS/WebRTC through the public broker -> phones on other networks,
 *  - BroadcastChannel -> extra tabs/windows in the same browser (and a
 *    reliable fallback when WebRTC or the broker is blocked).
 */

export const PEER_PREFIX = 'jeopardy-twist-'
export const channelName = (code: string) => `jeopardy-twist-${code.toUpperCase()}`

export type PeerStatus = 'idle' | 'connecting' | 'online' | 'error'

type LocalEnvelope =
  | { dir: 'up'; code: string; from: string; msg: ClientMessage }
  | { dir: 'down'; code: string; to: string | '*'; msg: HostMessage }
  | { dir: 'probe'; code: string; from: string }
  | { dir: 'probe-ack'; code: string; to: string }

export interface HostNet {
  code: string
  broadcast: (msg: HostMessage) => void
  send: (connId: string, msg: HostMessage) => void
  status: () => PeerStatus
  destroy: () => void
}

export interface HostHandlers {
  onMessage: (connId: string, msg: ClientMessage) => void
  onDisconnect: (connId: string) => void
  onStatus: (status: PeerStatus, detail?: string) => void
}

export function createHost(code: string, handlers: HostHandlers): HostNet {
  const upper = code.toUpperCase()
  const channel = new BroadcastChannel(channelName(upper))
  const peerConnections = new Map<string, DataConnection>()
  const localPeers = new Set<string>()
  let peer: PeerType | null = null
  let status: PeerStatus = 'connecting'
  let destroyed = false

  channel.onmessage = (event: MessageEvent<LocalEnvelope>) => {
    const data = event.data
    if (!data || data.code !== upper) return
    if (data.dir === 'probe') {
      localPeers.add(data.from)
      channel.postMessage({ dir: 'probe-ack', code: upper, to: data.from } satisfies LocalEnvelope)
      return
    }
    if (data.dir === 'up') {
      localPeers.add(data.from)
      handlers.onMessage(data.from, data.msg)
    }
  }

  const setStatus = (next: PeerStatus, detail?: string) => {
    status = next
    handlers.onStatus(next, detail)
  }

  // PeerJS is loaded lazily so a blocked broker never delays the lobby.
  const startPeer = async (attempt = 0) => {
    try {
      const { Peer } = await import('peerjs')
      if (destroyed) return
      peer = new Peer(`${PEER_PREFIX}${upper}`, { debug: 0 })
      peer.on('open', () => setStatus('online'))
      peer.on('error', (error: { type?: string; message?: string }) => {
        // A remounted host (React strict mode, hot reload) still holds the id
        // on the broker for a moment — take it back instead of giving up.
        if (error?.type === 'unavailable-id' && attempt < 3 && !destroyed) {
          peer?.destroy()
          window.setTimeout(() => void startPeer(attempt + 1), 1200)
          return
        }
        setStatus('error', error?.type ?? error?.message ?? 'peer error')
      })
      peer.on('connection', (connection: DataConnection) => {
        const id = connection.peer
        peerConnections.set(id, connection)
        connection.on('data', (raw: unknown) => {
          handlers.onMessage(id, raw as ClientMessage)
        })
        connection.on('close', () => {
          peerConnections.delete(id)
          handlers.onDisconnect(id)
        })
        connection.on('error', () => {
          peerConnections.delete(id)
          handlers.onDisconnect(id)
        })
      })
    } catch (error) {
      setStatus('error', error instanceof Error ? error.message : 'peer unavailable')
    }
  }
  void startPeer()

  return {
    code: upper,
    broadcast(msg) {
      channel.postMessage({ dir: 'down', code: upper, to: '*', msg } satisfies LocalEnvelope)
      peerConnections.forEach((connection) => {
        if (connection.open) connection.send(msg)
      })
    },
    send(connId, msg) {
      if (localPeers.has(connId)) {
        channel.postMessage({ dir: 'down', code: upper, to: connId, msg } satisfies LocalEnvelope)
      }
      const connection = peerConnections.get(connId)
      if (connection?.open) connection.send(msg)
    },
    status: () => status,
    destroy() {
      destroyed = true
      channel.close()
      peerConnections.forEach((connection) => connection.close())
      peerConnections.clear()
      peer?.destroy()
    },
  }
}

export interface ClientNet {
  id: string
  transport: 'local' | 'peer'
  send: (msg: ClientMessage) => void
  destroy: () => void
}

export interface ClientHandlers {
  onMessage: (msg: HostMessage) => void
  onClose: () => void
}

/** Resolves once a host answers — same-browser first (instant), then WebRTC. */
export async function connectToHost(
  code: string,
  handlers: ClientHandlers,
): Promise<ClientNet> {
  const upper = code.toUpperCase()
  const id = randomId('c')
  const channel = new BroadcastChannel(channelName(upper))

  const localHostFound = await new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), 600)
    channel.addEventListener('message', function listener(event: MessageEvent<LocalEnvelope>) {
      const data = event.data
      if (data?.code === upper && data.dir === 'probe-ack' && data.to === id) {
        window.clearTimeout(timer)
        channel.removeEventListener('message', listener)
        resolve(true)
      }
    })
    channel.postMessage({ dir: 'probe', code: upper, from: id } satisfies LocalEnvelope)
  })

  if (localHostFound) {
    channel.onmessage = (event: MessageEvent<LocalEnvelope>) => {
      const data = event.data
      if (!data || data.code !== upper || data.dir !== 'down') return
      if (data.to === '*' || data.to === id) handlers.onMessage(data.msg)
    }
    return {
      id,
      transport: 'local',
      send(msg) {
        channel.postMessage({ dir: 'up', code: upper, from: id, msg } satisfies LocalEnvelope)
      },
      destroy() {
        channel.close()
      },
    }
  }

  channel.close()
  const { Peer } = await import('peerjs')
  const peer = new Peer({ debug: 0 })

  return await new Promise<ClientNet>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      peer.destroy()
      reject(new Error('Nie udało się połączyć z hostem. Sprawdź kod pokoju.'))
    }, 15000)

    peer.on('error', (error: { type?: string; message?: string }) => {
      window.clearTimeout(timer)
      peer.destroy()
      reject(
        new Error(
          error?.type === 'peer-unavailable'
            ? 'Nie ma pokoju o takim kodzie. Poproś administratora o aktualny kod.'
            : 'Połączenie przez internet nie działa w tej sieci. Otwórz grę w tej samej przeglądarce co host albo spróbuj innej sieci.',
        ),
      )
    })

    peer.on('open', () => {
      const connection = peer.connect(`${PEER_PREFIX}${upper}`, { reliable: true })
      connection.on('open', () => {
        window.clearTimeout(timer)
        resolve({
          id: peer.id,
          transport: 'peer',
          send(msg) {
            if (connection.open) connection.send(msg)
          },
          destroy() {
            connection.close()
            peer.destroy()
          },
        })
      })
      connection.on('data', (raw: unknown) => handlers.onMessage(raw as HostMessage))
      connection.on('close', handlers.onClose)
    })
  })
}
