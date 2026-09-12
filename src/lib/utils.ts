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
