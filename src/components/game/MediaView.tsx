import { createContext, useContext, type ReactNode } from 'react'
import { Volume2 } from 'lucide-react'
import type { MediaKind } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Accepts both the editor's `Media` (host, always has a src) and the player-safe
 * `PublicMedia` (src may be missing for a host-only-sized upload — `mediaId` is then the
 * fallback, resolved against the preloaded bundle via `MediaCacheContext`). */
type ViewableMedia = { kind: MediaKind; src?: string; label?: string; mediaId?: string }

/**
 * id -> data: URL for every local media file the player has preloaded on join (see
 * `mediaBundle` in `useHostGame.ts` / `usePlayerGame.ts`). `Play.tsx` provides this once near
 * its root via `MediaCacheProvider`; host-side screens never provide one, which is fine — they
 * always have `media.src` directly from the pack and never need the fallback.
 */
const MediaCacheContext = createContext<Map<string, string> | null>(null)

export function MediaCacheProvider({
  value,
  children,
}: {
  value: Map<string, string>
  children: ReactNode
}) {
  return <MediaCacheContext.Provider value={value}>{children}</MediaCacheContext.Provider>
}

/**
 * Shows the question's media inline (image, audio player, or video player) and, for audio
 * and video, starts it automatically — but only once per element mount, and never on a
 * loop. Every browser default here is "play once and stop": no `loop` attribute is set
 * anywhere in this component, intentionally, so a clip never repeats on its own.
 */
export function MediaView({
  media,
  className,
  hideLabel,
}: {
  media?: ViewableMedia
  className?: string
  /** Players don't need to see the raw uploaded filename (e.g. "koncert_2019.mp3") — only the
   * host/admin does. Pass `true` from player-facing screens (`Play.tsx`); host screens
   * (`QuestionStage.tsx`, `FinalStage.tsx`) leave it unset and keep showing the label. */
  hideLabel?: boolean
}) {
  const cache = useContext(MediaCacheContext)
  // `src` wins when the host inlined it directly; otherwise fall back to the copy this player
  // preloaded on join (see `MediaCacheProvider` above) — resolved by `mediaId`, so a big local
  // upload still plays instantly instead of needing a transfer right at reveal time.
  const src = media?.src ?? (media?.mediaId ? cache?.get(media.mediaId) : undefined)
  if (!media || !src) return null
  const label = hideLabel ? undefined : media.label
  if (media.kind === 'image') {
    return (
      <figure className={cn('overflow-hidden rounded-card border border-stage-600', className)}>
        <img src={src} alt={label ?? 'Materiał do pytania'} className="max-h-[46vh] w-full object-contain bg-black/40" />
        {label ? (
          <figcaption className="bg-black/40 px-3 py-1.5 text-xs text-white/60">{label}</figcaption>
        ) : null}
      </figure>
    )
  }
  if (media.kind === 'audio') {
    return (
      <div className={cn('rounded-card border border-stage-600 bg-black/30 p-4', className)}>
        <div className="mb-2 flex items-center gap-2 text-sm text-white/70">
          <Volume2 className="size-4 text-gold" />
          {label ?? 'Nagranie audio'}
        </div>
        <audio src={src} controls autoPlay className="w-full" />
      </div>
    )
  }
  const embed = youtubeEmbedUrl(src)
  return (
    <div className={cn('overflow-hidden rounded-card border border-stage-600 bg-black/40', className)}>
      {embed ? (
        <iframe
          src={embed}
          title={label ?? 'Wideo'}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <video src={src} controls autoPlay className="max-h-[46vh] w-full" />
      )}
      {label ? <div className="px-3 py-1.5 text-xs text-white/60">{label}</div> : null}
    </div>
  )
}

/**
 * Turns a YouTube watch/share/shorts URL into a youtube-nocookie.com embed URL (privacy-enhanced
 * mode — fewer tracking cookies, no channel-branded overlay — and it plays inline instead of
 * being an unplayable `<video src="https://www.youtube.com/watch?v=…">`, which is not a media
 * file at all). Returns `null` for anything that isn't a recognizable YouTube link, so a direct
 * `.mp4`/etc. URL still falls through to the plain `<video>` tag above.
 */
function youtubeEmbedUrl(src: string): string | null {
  let url: URL
  try {
    url = new URL(src)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '')
  let id: string | null = null
  if (host === 'youtu.be') {
    id = url.pathname.slice(1)
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else if (url.pathname.startsWith('/embed/')) id = url.pathname.slice('/embed/'.length)
    else if (url.pathname.startsWith('/shorts/')) id = url.pathname.slice('/shorts/'.length)
    else if (url.pathname.startsWith('/live/')) id = url.pathname.slice('/live/'.length)
  }
  id = id?.split(/[?&/]/)[0] || null
  if (!id) return null
  const start = url.searchParams.get('t') ?? url.searchParams.get('start')
  const startSeconds = start ? Number(start.replace(/s$/, '')) : null
  const params = new URLSearchParams({ rel: '0', modestbranding: '1', autoplay: '1' })
  if (startSeconds) params.set('start', String(startSeconds))
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`
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
