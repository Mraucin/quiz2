import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Panel, PanelTitle } from '@/components/ui/primitives'

export function JoinPanel({ code, joinUrl }: { code: string; joinUrl: string }) {
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    QRCode.toDataURL(joinUrl, {
      width: 220,
      margin: 1,
      color: { dark: '#0b0a1f', light: '#f8e7b5' },
    })
      .then(setQr)
      .catch(() => setQr(null))
  }, [joinUrl])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Panel className="flex flex-col items-center gap-3 text-center">
      <PanelTitle>Dołącz do lobby</PanelTitle>
      <div className="text-display text-5xl tracking-[0.35em] text-gold">{code}</div>
      {qr ? (
        <img src={qr} alt="Kod QR do dołączenia" className="rounded-xl border border-gold/40" />
      ) : null}
      <div className="w-full truncate rounded-lg bg-black/30 px-3 py-2 text-xs text-white/60">
        {joinUrl}
      </div>
      <Button variant="outline" onClick={copy} className="w-full">
        {copied ? <Check className="size-4 text-mint" /> : <Copy className="size-4" />}
        {copied ? 'Skopiowano' : 'Kopiuj link dla graczy'}
      </Button>
    </Panel>
  )
}
