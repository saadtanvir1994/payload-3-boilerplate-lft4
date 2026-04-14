'use client'

import React, { useEffect, useState } from 'react'

interface UserData {
  id: number
  fullName: string
  referralCode: string
  mobileNumber: string
}

interface ReferralLog {
  id: number
  referredUser?: { fullName?: string }
  status: string
  createdAt: string
}

export default function ReferralPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [logs, setLogs] = useState<ReferralLog[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await fetch('/api/me', { credentials: 'include' }).then((r) => r.json()) as { user?: UserData }
        if (!me.user) return
        setUser(me.user)

        const res = await fetch(
          `/api/payload-proxy/referral-logs?where[referrer][equals]=${me.user.id}&limit=20&sort=-createdAt&depth=1`,
          { credentials: 'include' },
        )
        const data = (await res.json()) as { docs?: ReferralLog[] }
        setLogs(data.docs ?? [])
      } catch { /* non-fatal */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  function copyLink() {
    if (!user?.referralCode) return
    const link = `${window.location.origin}/booking?ref=${user.referralCode}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function shareWhatsApp() {
    if (!user?.referralCode) return
    const link = `${window.location.origin}/booking?ref=${user.referralCode}`
    const msg = `Book your car detailing with Alpha Wheels! Use my referral link and I'll earn a discount: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-40 bg-muted rounded-xl" /></div>

  const rewarded = logs.filter((l) => l.status === 'Rewarded').length

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">Refer & Earn</h1>

      {/* How it works */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold">How it works</p>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <p>1️⃣ Share your referral code with friends</p>
          <p>2️⃣ They book using your code</p>
          <p>3️⃣ After their first completed booking, you receive a <span className="font-medium text-foreground">10% discount voucher</span></p>
        </div>
      </div>

      {/* Referral code card */}
      {user?.referralCode && (
        <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-1">Your Referral Code</p>
            <p className="font-mono text-3xl font-bold tracking-widest">{user.referralCode}</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={copyLink}
              className="py-2 px-3 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
            >
              {copied ? '✓ Copied!' : '🔗 Copy Link'}
            </button>
            <button
              onClick={shareWhatsApp}
              className="py-2 px-3 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
            >
              📲 Share on WhatsApp
            </button>
          </div>

          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground text-center">
              Or share this link directly:
            </p>
            <p className="text-xs text-primary text-center mt-1 break-all">
              {typeof window !== 'undefined' ? `${window.location.origin}/booking?ref=${user.referralCode}` : ''}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold">{logs.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Referrals</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-2xl font-bold text-primary">{rewarded}</p>
          <p className="text-xs text-muted-foreground mt-1">Vouchers Earned</p>
        </div>
      </div>

      {/* Referral history */}
      {logs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Referral History</p>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{log.referredUser?.fullName ?? 'New Customer'}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  log.status === 'Rewarded'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
