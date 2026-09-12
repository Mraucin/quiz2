import { Volume2 } from 'lucide-react'
import type { MediaKind } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Accepts both the editor's `Media` (host, always has a src) and the player-safe
 * `PublicMedia` (src may be missing for host-only uploads) — same rendering either way. */
type ViewableMedia = { kind: MediaKind; src?: string; label?: string }

/**
 * Shows the question's media inline (image, audio player, or video player) and, for audio
 * and video, starts it automatically — but only once per element mount, and never on a
 * loop. Every browser default here is "play once and stop": no `loop` attribute is set
 * anywhere in this component, intentionally, so a clip never repeats on its own.
 */
export function MediaView({ media, className }: { media?: ViewableMedia; className?: string }) {
  if (!media?.src) return null
  if (media.kind === 'image') {
    return (
      <figure className={cn('overflow-hidden rounded-card border border-stage-600', className)}>
        <img src={media.src} alt={media.label ?? 'Materiał do pytania'} className="max-h-[46vh] w-full object-contain bg-black/40" />
        {media.label ? (
          <figcaption className="bg-black/40 px-3 py-1.5 text-xs text-white/60">{media.label}</figcaption>
        ) : null}
      </figure>
    )
  }
  if (media.kind === 'audio') {
    return (
      <div className={cn('rounded-card border border-stage-600 bg-black/30 p-4', className)}>
        <div className="mb-2 flex items-center gap-2 text-sm text-white/70">
          <Volume2 className="size-4 text-gold" />
          {media.label ?? 'Nagranie audio'}
        </div>
        <audio src={media.src} controls autoPlay className="w-full" />
      </div>
    )
  }
  return (
    <div className={cn('overflow-hidden rounded-card border border-stage-600 bg-black/40', className)}>
      <video src={media.src} controls autoPlay className="max-h-[46vh] w-full" />
      {media.label ? <div className="px-3 py-1.5 text-xs text-white/60">{media.label}</div> : null}
    </div>
  )
}

/** Speech-synthesis fallback for audio questions that ship without a recording. */
export function SpeakButton({ text, lang = 'ja-JP' }: { text: string; lang?: string }) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  if (!supported) return null
  const speak = () => {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 0.85
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }
  return (
    <Button variant="primary" size="lg" onClick={speak}>
      <Volume2 className="size-5" />
      Odtwórz lektora
    </Button>
  )
}
