'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface SessionUser {
  id: number
  fullName: string
  role: string
  currentTier: string
  loyaltyPointsBalance: number
}

const NAV = [
  { href: '/my/dashboard', label: '🏠 Dashboard' },
  { href: '/my/bookings', label: '📋 Bookings' },
  { href: '/my/vouchers', label: '🎟 Vouchers' },
  { href: '/my/referral', label: '🔗 Referral' },
  { href: '/my/profile', label: '👤 Profile' },
]

export default function MyLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<SessionUser | null>(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { user?: SessionUser | null }) => {
        if (!d.user) {
          router.replace('/booking')
        } else {
          setUser(d.user)
        }
      })
      .catch(() => router.replace('/booking'))
      .finally(() => setChecking(false))
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <div className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">AW</span>
            </div>
            <span className="font-semibold text-sm">Alpha Wheels</span>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium">{user.fullName}</p>
            <p className="text-xs text-muted-foreground">{user.currentTier} · {user.loyaltyPointsBalance} pts</p>
          </div>
        </div>
      </div>

      {/* Nav tabs */}
      <div className="border-b border-border bg-card overflow-x-auto">
        <div className="max-w-2xl mx-auto px-4 flex gap-1 py-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                pathname === n.href || pathname?.startsWith(n.href + '/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">{children}</div>
    </div>
  )
}
