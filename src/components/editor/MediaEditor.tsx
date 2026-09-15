import { useRef, useState } from 'react'
import { Image, Music, Upload, Video, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge, Input, Label, Select } from '@/components/ui/primitives'
import { fileToDataUrl, formatBytes } from '@/lib/storage'
import type { Media, MediaKind } from '@/lib/types'
import { approxDataUrlBytes, MAX_PLAYER_MEDIA_BYTES } from '@/lib/utils'

const kindIcon = { image: Image, audio: Music, video: Video } as const
const accept: Record<MediaKind, string> = {
  image: 'image/*',
  audio: 'audio/*',
  video: 'video/*',
}

export function MediaEditor({
  label,
  value,
  onChange,
}: {
  label: string
  value?: Media
  onChange: (media?: Media) => void
}) {
  const [kind, setKind] = useState<MediaKind>(value?.kind ?? 'image')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const Icon = kindIcon[value?.kind ?? kind]

  const upload = async (file: File) => {
    setBusy(true)
    try {
      const src = await fileToDataUrl(file)
      onChange({ kind, src, label: file.name })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-stage-600 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="mb-0">{label}</Label>
        {value ? (
          <Button size="sm" variant="ghost" onClick={() => onChange(undefined)}>
            <X className="size-4 text-coral" /> Usuń
          </Button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Select
          className="h-9 w-32"
          value={value?.kind ?? kind}
          onChange={(event) => {
            const next = event.target.value as MediaKind
            setKind(next)
            if (value) onChange({ ...value, kind: next })
          }}
        >
          <option value="image">Zdjęcie</option>
          <option value="audio">Audio</option>
          <option value="video">Wideo</option>
        </Select>
        <Input
          className="h-9 flex-1 min-w-[12rem]"
          placeholder="https://… (link do pliku)"
          value={value?.src.startsWith('data:') ? '' : (value?.src ?? '')}
          onChange={(event) =>
            onChange(
              event.target.value
                ? { kind: value?.kind ?? kind, src: event.target.value, label: value?.label }
                : undefined,
            )
          }
        />
        <input
          ref={fileInput}
          type="file"
          accept={accept[value?.kind ?? kind]}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
          }}
        />
        <Button size="sm" variant="secondary" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Upload className="size-4" /> {busy ? 'Wczytuję…' : 'Wgraj plik'}
        </Button>
      </div>
      {value ? (
        <div className="mt-2 flex items-center gap-2 text-xs text-white/55">
          <Icon className="size-4 text-gold" />
          <span className="truncate">
            {value.src.startsWith('data:')
              ? `plik w przeglądarce (${formatBytes(approxDataUrlBytes(value.src))})`
              : value.src}
          </span>
          {!value.src.startsWith('data:') ||
          approxDataUrlBytes(value.src) <= MAX_PLAYER_MEDIA_BYTES ? (
            <Badge tone="mint">telefony: od razu</Badge>
          ) : (
            <Badge tone="mint" title={`Plik > ${formatBytes(MAX_PLAYER_MEDIA_BYTES)} — dociera do telefonów w paczce preloadu przy dołączeniu do gry, nie w błyskawicznej synchronizacji na żywo.`}>
              telefony: z preloadu
            </Badge>
          )}
        </div>
      ) : null}
    </div>
  )
}
