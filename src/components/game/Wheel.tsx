import { useEffect, useRef, useState } from 'react'
import { WHEEL_SEGMENTS } from '@/lib/defaultPack'
import { cn } from '@/lib/utils'

const SEG = 360 / WHEEL_SEGMENTS.length
/** Duration of the spin animation — shared with callers that gate letter-guessing until it finishes. */
export const WHEEL_SPIN_MS = 2600
const CX = 100
const CY = 100
const R = 96
const LABEL_R = R * 0.6

/** Point on the circle for a given angle, measured clockwise from 12 o'clock. */
function polar(deg: number, radius: number) {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) }
}

/** Keep radial labels upright: flip 180° whenever they'd otherwise read upside-down. */
function labelRotation(midDeg: number) {
  const rotate = midDeg
  const normalized = ((rotate % 360) + 360) % 360
  return normalized > 90 && normalized < 270 ? rotate + 180 : rotate
}

export function Wheel({ index, nonce, size = 260 }: { index: number; nonce: number; size?: number }) {
  const [rotation, setRotation] = useState(0)
  const lastNonce = useRef(nonce)

  useEffect(() => {
    if (nonce === lastNonce.current) return
    lastNonce.current = nonce
    const target = 360 - (index * SEG + SEG / 2)
    setRotation((current) => Math.ceil(current / 360) * 360 + 360 * 4 + target)
  }, [nonce, index])

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div
        className="z-10 -mb-1 text-gold"
        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}
      >
        ▼
      </div>
      <div
        className="relative shrink-0 overflow-hidden rounded-full border-4 border-gold/70 tile-shadow"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 200 200"
          width="100%"
          height="100%"
          style={{
            display: 'block',
            transform: `rotate(${rotation}deg)`,
            // Must be a percentage: at any px value other than exactly this element's own
            // rendered size, the pivot drifts off the real hub and the wheel visibly spins
            // (and rests) off-center instead of around itself.
            transformOrigin: '50% 50%',
            transition: `transform ${WHEEL_SPIN_MS}ms cubic-bezier(0.15, 0.85, 0.12, 1)`,
          }}
        >
          {WHEEL_SEGMENTS.map((segment, i) => {
            const startDeg = i * SEG
            const endDeg = (i + 1) * SEG
            const midDeg = i * SEG + SEG / 2
            const start = polar(startDeg, R)
            const end = polar(endDeg, R)
            const largeArc = SEG > 180 ? 1 : 0
            const path = `M ${CX} ${CY} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${R} ${R} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`
            const fill = segment.bankrupt
              ? 'oklch(0.45 0.2 25)'
              : i % 2 === 0
                ? 'oklch(0.42 0.16 268)'
                : 'oklch(0.55 0.17 300)'
            const labelPos = polar(midDeg, LABEL_R)
            const rotate = labelRotation(midDeg)
            const textStyle = {
              fill: segment.bankrupt ? '#fff' : 'rgba(255,255,255,0.95)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
            } as const
            return (
              <g key={`${segment.label}-${i}`}>
                <path d={path} style={{ fill }} stroke="rgba(0,0,0,0.3)" strokeWidth={0.6} />
                {segment.bankrupt ? (
                  // Long word — stack it letter by letter so it reads top-to-bottom along the spoke
                  // instead of overflowing sideways into the neighbouring wedges.
                  segment.label.split('').map((char, charIndex, chars) => {
                    const lineHeight = 9.5
                    const offset = (charIndex - (chars.length - 1) / 2) * lineHeight
                    return (
                      <text
                        key={charIndex}
                        x={labelPos.x}
                        y={labelPos.y + offset}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        transform={`rotate(${rotate} ${labelPos.x} ${labelPos.y})`}
                        style={{ ...textStyle, fontSize: 9 }}
                      >
                        {char}
                      </text>
                    )
                  })
                ) : (
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${rotate} ${labelPos.x} ${labelPos.y})`}
                    style={{ ...textStyle, fontSize: 15 }}
                  >
                    {segment.label}
                  </text>
                )}
              </g>
            )
          })}
          <circle cx={CX} cy={CY} r={13} style={{ fill: 'var(--color-gold)' }} />
        </svg>
      </div>
    </div>
  )
}

export function PhraseBoard({ masked, hint }: { masked: string[]; hint: string }) {
  const words: string[][] = [[]]
  masked.forEach((char) => {
    if (char === ' ') words.push([])
    else words[words.length - 1].push(char)
  })
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {words.map((word, wordIndex) => (
          <div key={wordIndex} className="flex gap-1">
            {word.map((char, charIndex) => (
              <span
                key={charIndex}
                className={cn(
                  'grid size-9 place-items-center rounded-md border text-display text-xl sm:size-11 sm:text-2xl',
                  char
                    ? 'border-gold/60 bg-white text-stage-900'
                    : 'border-stage-600 bg-stage-700/70 text-transparent',
                )}
              >
                {char || '?'}
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="rounded-full bg-black/40 px-4 py-1 text-xs tracking-[0.2em] text-gold uppercase">
        {hint}
      </div>
    </div>
  )
}
