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
 * the peer-to-peer connection, same as the host screen. Bigger ones stay host-only — a
 * game-state broadcast (and therefore this blob) is re-sent on every action taken while the
 * question stays open (judging, score corrections, closing it), not continuously, so a
 * generous cap is fine — this covers a multi-minute MP3 comfortably, while still keeping a
 * multi-minute 4K video upload host-only.
 */
export const MAX_PLAYER_MEDIA_BYTES = 15 * 1024 * 1024

/**
 * Max length of a serialized final-round answer (`GameAction: 'finalAnswer'.text`) — since the
 * answer is now a handwritten `DrawingPad` sketch (JSON array of stroke points, see
 * `DrawingPad.tsx`), not typed text, a real answer can run to a few thousand characters. This
 * cap just guards against a pathologically huge/malformed payload bloating every game-state
 * broadcast while the final question is open, not against normal handwriting.
 */
export const MAX_FINAL_ANSWER_CHARS = 20000

/** Rough decoded size of a `data:` URL — good enough for a UI hint or a forwarding cutoff. */
export function approxDataUrlBytes(src: string) {
  return src.length * 0.75
}

/**
 * Cheap, deterministic id for a media `src` string — the same content always maps to the same
 * id, so a player can look a file up in the media bundle it preloaded on join (see
 * `buildMediaBundle` in `engine.ts`) without the host having to re-embed the bytes inline in
 * every game-state broadcast. Samples the string instead of hashing it in full, so it stays
 * fast even for a multi-megabyte upload; collisions are astronomically unlikely for the
 * handful of media files a real pack has.
 */
export function mediaHashId(src: string): string {
  const sampleStep = Math.max(1, Math.floor(src.length / 2000))
  let hash = 2166136261 // FNV-1a 32-bit offset basis
  for (let i = 0; i < src.length; i += sampleStep) {
    hash ^= src.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  hash ^= src.length
  hash = Math.imul(hash, 16777619)
  return (hash >>> 0).toString(36)
}
