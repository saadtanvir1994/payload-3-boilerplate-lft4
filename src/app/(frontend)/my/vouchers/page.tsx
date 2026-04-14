'use client'

import React, { useEffect, useState } from 'react'

interface Voucher {
  id: number
  code: string
  discountPercent?: number
  validUntil: string
  isUsed: boolean
  usedAt?: string
  source?: string
}

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await fetch('/api/me', { credentials: 'include' }).then((r) => r.json()) as { user?: { id: number } }
        if (!me.user) return

        const res = await fetch(
          `/api/payload-proxy/vouchers?where[assignedToUser][equals]=${me.user.id}&limit=50&sort=-createdAt`,
          { credentials: 'include' },
        )
        const data = (await res.json()) as { docs?: Voucher[] }
        setVouchers(data.docs ?? [])
      } catch { /* non-fatal */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div className="animate-pulse space-y-3">{[1,2].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}</div>

  const active = vouchers.filter((v) => !v.isUsed && new Date(v.validUntil) >= new Date())
  const expired = vouchers.filter((v) => v.isUsed || new Date(v.validUntil) < new Date())

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">My Vouchers</h1>

      {vouchers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">🎟</p>
          <p className="font-medium">No vouchers yet</p>
          <p className="text-sm mt-1">Refer a friend to earn a discount voucher.</p>
        </div>
      )}

      {active.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Active</p>
          <div className="space-y-2">
            {active.map((v) => (
              <VoucherCard key={v.id} voucher={v} />
            ))}
          </div>
        </div>
      )}

      {expired.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Used / Expired</p>
          <div className="space-y-2 opacity-60">
            {expired.map((v) => (
              <VoucherCard key={v.id} voucher={v} dimmed />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function VoucherCard({ voucher, dimmed }: { voucher: Voucher; dimmed?: boolean }) {
  const [copied, setCopied] = useState(false)

  function copyCode() {
    navigator.clipboard.writeText(voucher.code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const expiry = new Date(voucher.validUntil)
  const isExpired = expiry < new Date()

  return (
    <div className={`rounded-xl border bg-card p-4 ${dimmed ? 'border-border' : 'border-primary/30'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-lg tracking-wider">{voucher.code}</span>
            {!dimmed && (
              <button
                onClick={copyCode}
                className="text-xs text-primary hover:underline"
              >
                {copied ? '✓ Copied' : 'Copy'}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {voucher.isUsed
              ? `Used${voucher.usedAt ? ` on ${new Date(voucher.usedAt).toLocaleDateString('en-PK')}` : ''}`
              : isExpired
              ? 'Expired'
              : `Valid until ${expiry.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-primary">{voucher.discountPercent ?? 10}%</p>
          <p className="text-xs text-muted-foreground">OFF</p>
        </div>
      </div>
      {!dimmed && (
        <p className="text-xs text-muted-foreground mt-2">
          Enter this code at checkout to apply your discount.
        </p>
      )}
    </div>
  )
}
