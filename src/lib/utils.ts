import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPoints(value: number) {
  const sign = value < 0 ? '-' : ''
  return `${sign}${Math.abs(value).toLocaleString('pl-PL')}`
}

let idCounter = 0

export function randomId(prefix = '') {
  idCounter += 1
  return `${prefix}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

export function roomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 5; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return out
}

/**
 * Local uploads (`data:` URLs) at or under this size are forwarded to players' phones over
 * the peer-to-peer connection, same as the host screen. Bigger ones stay host-only — they'd
 * get re-sent in full on every game-state broadcast (every buzz, every score change while the
 * question is open), which would bog down the connection to every phone.
 */
export const MAX_PLAYER_MEDIA_BYTES = 4 * 1024 * 1024

/** Rough decoded size of a `data:` URL — good enough for a UI hint or a forwarding cutoff. */
export function approxDataUrlBytes(src: string) {
  return src.length * 0.75
}
