import { DEFAULT_PACK, DEFAULT_RULES } from './defaultPack'
import type { Pack } from './types'

const DB_NAME = 'jeopardy-twist'
const STORE = 'packs'
const PACK_KEY = 'current'
const LS_KEY = 'jeopardy-twist:pack'

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
  })
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readonly')
    const request = tx.objectStore(STORE).get(key)
    request.onsuccess = () => resolve((request.result as T) ?? null)
    request.onerror = () => resolve(null)
  })
}

async function idbSet(key: string, value: unknown): Promise<boolean> {
  const db = await openDb()
  if (!db) return false
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(value, key)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => resolve(false)
  })
}

export function normalizePack(raw: unknown): Pack | null {
  if (!raw || typeof raw !== 'object') return null
  const pack = raw as Partial<Pack>
  if (!Array.isArray(pack.categories)) return null
  return {
    id: pack.id ?? 'pack-imported',
    name: pack.name ?? 'Zaimportowany pakiet',
    description: pack.description,
    updatedAt: pack.updatedAt ?? Date.now(),
    rules: { ...DEFAULT_RULES, ...(pack.rules ?? {}) },
    categories: pack.categories,
    final: Array.isArray(pack.final) ? pack.final : [],
  }
}

export async function loadPack(): Promise<Pack> {
  const fromDb = await idbGet<Pack>(PACK_KEY)
  const normalizedDb = normalizePack(fromDb)
  if (normalizedDb) return normalizedDb
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) {
      const normalized = normalizePack(JSON.parse(raw))
      if (normalized) return normalized
    }
  } catch {
    /* ignore corrupted local copy */
  }
  return structuredClone(DEFAULT_PACK)
}

export async function savePack(pack: Pack): Promise<void> {
  const payload: Pack = { ...pack, updatedAt: Date.now() }
  const ok = await idbSet(PACK_KEY, payload)
  if (ok) return
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload))
  } catch {
    console.warn('Nie udało się zapisać pakietu — prawdopodobnie za duże multimedia.')
  }
}

export function downloadPack(pack: Pack) {
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${pack.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`
  link.click()
  URL.revokeObjectURL(url)
}

export async function readPackFile(file: File): Promise<Pack> {
  const text = await file.text()
  const pack = normalizePack(JSON.parse(text))
  if (!pack) throw new Error('To nie jest poprawny plik pakietu pytań.')
  return pack
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Nie udało się wczytać pliku.'))
    reader.readAsDataURL(file)
  })
}

export function approximatePackSize(pack: Pack) {
  return new Blob([JSON.stringify(pack)]).size
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const PLAYER_KEY = 'jeopardy-twist:player'

export function rememberPlayer(code: string, playerId: string, name: string, avatar: string) {
  try {
    localStorage.setItem(PLAYER_KEY, JSON.stringify({ code, playerId, name, avatar }))
  } catch {
    /* storage disabled */
  }
}

export function recallPlayer(): { code: string; playerId: string; name: string; avatar: string } | null {
  try {
    const raw = localStorage.getItem(PLAYER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
