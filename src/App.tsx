import { useCallback, useEffect, useRef, useState } from 'react'
import { AdminScreen } from '@/screens/Admin'
import { EditorScreen } from '@/screens/Editor'
import { HomeScreen } from '@/screens/Home'
import { PlayScreen } from '@/screens/Play'
import { loadPack, savePack } from '@/lib/storage'
import type { Pack } from '@/lib/types'

function parseHash() {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, query] = raw.split('?')
  return { path: path || '/', params: new URLSearchParams(query ?? '') }
}

function useHashRoute() {
  const [route, setRoute] = useState(parseHash)
  useEffect(() => {
    const onChange = () => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const navigate = useCallback((path: string) => {
    window.location.hash = path
  }, [])
  return { ...route, navigate }
}

export default function App() {
  const { path, params, navigate } = useHashRoute()
  const [pack, setPack] = useState<Pack | null>(null)
  const saveTimer = useRef<number | null>(null)

  useEffect(() => {
    void loadPack().then(setPack)
  }, [])

  const updatePack = useCallback((next: Pack) => {
    setPack(next)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => void savePack(next), 500)
  }, [])

  if (!pack) {
    return (
      <div className="grid min-h-screen place-items-center text-white/60">
        <div className="text-display animate-glow text-2xl text-gold">Ładowanie studia…</div>
      </div>
    )
  }

  if (path === '/admin') return <AdminScreen pack={pack} navigate={navigate} />
  if (path === '/play')
    return <PlayScreen initialCode={(params.get('code') ?? '').toUpperCase()} navigate={navigate} />
  if (path === '/editor')
    return <EditorScreen pack={pack} setPack={updatePack} navigate={navigate} />
  return <HomeScreen pack={pack} navigate={navigate} />
}
