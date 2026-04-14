'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { user?: { role?: string } }) => {
        if (!d.user || d.user.role !== 'admin') {
          router.replace('/booking')
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

  return (
    <div className="min-h-screen bg-background text-foreground ">
      <div className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-xs font-bold">AW</span>
            </div>
            <span className="font-semibold text-sm">Alpha Wheels — Admin</span>
          </div>
          <Link
            href="/payload/admin"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            CMS Panel →
          </Link>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-6">{children}</div>
    </div>
  )
}
