'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

interface MembershipCard {
  currentTier: string
  servicesCompletedInCycle: number
  totalServicesEver: number
  freeSlotUnlocked: boolean
  freeSlotUsed: boolean
}

interface UserData {
  id: number
  fullName: string
  currentTier: string
  loyaltyPointsBalance: number
  referralCode: string
  mobileNumber: string
}

const TIER_COLORS: Record<string, string> = {
  Beginner: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  Gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  Platinum: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
}

const TIER_NEXT: Record<string, { next: string; at: number }> = {
  Beginner: { next: 'Gold', at: 7 },
  Gold: { next: 'Platinum', at: 14 },
  Platinum: { next: 'Max tier', at: 0 },
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null)
  const [card, setCard] = useState<MembershipCard | null>(null)
  const [recentBookings, setRecentBookings] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // Get session
        const meRes = await fetch('/api/me', { credentials: 'include' })
        const meData = (await meRes.json()) as { user?: UserData }
        if (!meData.user) return
        setUser(meData.user)

        // Get membership card
        const cardRes = await fetch(
          `/api/payload-proxy/membership-cards?where[user][equals]=${meData.user.id}&limit=1`,
          { credentials: 'include' },
        )
        const cardData = (await cardRes.json()) as { docs?: MembershipCard[] }
        if (cardData.docs?.[0]) setCard(cardData.docs[0])

        // Get recent bookings
        const bRes = await fetch(
          `/api/payload-proxy/bookings?where[user][equals]=${meData.user.id}&limit=3&sort=-createdAt`,
          { credentials: 'include' },
        )
        const bData = (await bRes.json()) as { docs?: Array<Record<string, unknown>> }
        setRecentBookings(bData.docs ?? [])
      } catch { /* non-fatal */ }
      finally { setLoading(false) }
    }
    loadDashboard()
  }, [])

  if (loading) return <LoadingState />

  const tier = user?.currentTier ?? 'Beginner'
  const nextTierInfo = TIER_NEXT[tier]
  const progress = card
    ? tier === 'Platinum'
      ? 100
      : Math.min(100, Math.round(((card.totalServicesEver ?? 0) / (nextTierInfo?.at ?? 7)) * 100))
    : 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Welcome back, {user?.fullName?.split(' ')[0] ?? 'there'}! 👋</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Here's your membership overview.</p>
      </div>

      {/* Tier card */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Tier</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-lg font-bold px-3 py-0.5 rounded-full text-sm ${TIER_COLORS[tier] ?? ''}`}>
                {tier}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Loyalty Points</p>
            <p className="text-2xl font-bold">{user?.loyaltyPointsBalance ?? 0}</p>
          </div>
        </div>

        {tier !== 'Platinum' && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progress to {nextTierInfo?.next}</span>
              <span>{card?.totalServicesEver ?? 0} / {nextTierInfo?.at} services</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Cycle status */}
      {card && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Services This Cycle</p>
            <p className="text-2xl font-bold mt-1">{card.servicesCompletedInCycle}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {card.freeSlotUnlocked ? '🎁 Free slot unlocked!' : `${6 - card.servicesCompletedInCycle} more for free slot`}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Total Services</p>
            <p className="text-2xl font-bold mt-1">{card.totalServicesEver}</p>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </div>
        </div>
      )}

      {/* Free slot banner */}
      {card?.freeSlotUnlocked && !card.freeSlotUsed && (
        <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-4 flex items-center gap-3">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="font-semibold text-sm text-green-800 dark:text-green-200">Free Service Unlocked!</p>
            <p className="text-xs text-green-700 dark:text-green-300">
              You've earned a free service. Book now and it will be applied automatically.
            </p>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Quick Actions</p>
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/booking"
            className="rounded-lg border border-border bg-card p-3 text-center hover:bg-accent transition-colors"
          >
            <p className="text-lg">🚗</p>
            <p className="text-sm font-medium mt-1">Book Service</p>
          </Link>
          <Link
            href="/my/referral"
            className="rounded-lg border border-border bg-card p-3 text-center hover:bg-accent transition-colors"
          >
            <p className="text-lg">🔗</p>
            <p className="text-sm font-medium mt-1">Refer & Earn</p>
          </Link>
        </div>
      </div>

      {/* Recent bookings */}
      {recentBookings.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent Bookings</p>
            <Link href="/my/bookings" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="space-y-2">
            {recentBookings.map((b) => (
              <Link
                key={b.id as number}
                href={`/my/bookings/${b.id}`}
                className="block rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">{b.bookingReference as string}</span>
                  <StatusBadge status={b.status as string} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PKR {(b.finalPrice as number | undefined)?.toLocaleString() ?? '—'}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    Completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] ?? ''}`}>
      {status}
    </span>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-6 w-48 bg-muted rounded" />
      <div className="h-32 bg-muted rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-muted rounded-lg" />
        <div className="h-24 bg-muted rounded-lg" />
      </div>
    </div>
  )
}
