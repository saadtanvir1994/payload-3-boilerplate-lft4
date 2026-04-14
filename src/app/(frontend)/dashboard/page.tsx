'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

interface StatsData {
  bookings: {
    total: number
    thisMonth: number
    lastMonth: number
    pending: number
    approved: number
    completed: number
    cancelled: number
  }
  revenue: { total: number; thisMonth: number }
  customers: number
  pendingPayments: number
  monthlyData: Array<{ month: string; bookings: number; revenue: number }>
  recentBookings: Array<{
    id: number
    bookingReference: string
    status: string
    finalPrice?: number
    createdAt: string
    user?: { fullName?: string } | null
    service?: { serviceName?: string } | null
  }>
}

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/stats', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: StatsData & { error?: string }) => {
        if (d.error) { setError(d.error); return }
        setStats(d)
      })
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingState />
  if (error) return (
    <div className="text-center py-12">
      <p className="text-destructive">{error}</p>
    </div>
  )
  if (!stats) return null

  const growth = stats.bookings.lastMonth > 0
    ? Math.round(((stats.bookings.thisMonth - stats.bookings.lastMonth) / stats.bookings.lastMonth) * 100)
    : 0

  const maxRevenue = Math.max(...stats.monthlyData.map((d) => d.revenue), 1)
  const maxBookings = Math.max(...stats.monthlyData.map((d) => d.bookings), 1)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">KPI Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {new Date().toLocaleDateString('en-PK', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link
          href="/payload/admin/collections/bookings"
          className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md font-medium"
        >
          Manage Bookings
        </Link>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total Revenue"
          value={`PKR ${stats.revenue.total.toLocaleString()}`}
          sub={`PKR ${stats.revenue.thisMonth.toLocaleString()} this month`}
          color="text-primary"
        />
        <KpiCard
          label="Total Bookings"
          value={stats.bookings.total}
          sub={`${stats.bookings.thisMonth} this month ${growth >= 0 ? `↑${growth}%` : `↓${Math.abs(growth)}%`}`}
          color={growth >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}
        />
        <KpiCard
          label="Customers"
          value={stats.customers}
          sub="registered"
        />
        <KpiCard
          label="Pending Payments"
          value={stats.pendingPayments}
          sub="awaiting confirmation"
          color={stats.pendingPayments > 0 ? 'text-yellow-600 dark:text-yellow-400' : undefined}
        />
      </div>

      {/* Status breakdown */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-sm font-semibold mb-4">Booking Status Breakdown</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Pending', value: stats.bookings.pending, color: 'bg-yellow-400' },
            { label: 'Approved', value: stats.bookings.approved, color: 'bg-blue-400' },
            { label: 'Completed', value: stats.bookings.completed, color: 'bg-green-400' },
            { label: 'Cancelled', value: stats.bookings.cancelled, color: 'bg-red-400' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${s.color} shrink-0`} />
              <div>
                <p className="text-lg font-bold leading-none">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-3 rounded-full overflow-hidden flex gap-0.5">
          {stats.bookings.total > 0 && [
            { value: stats.bookings.pending, color: 'bg-yellow-400' },
            { value: stats.bookings.approved, color: 'bg-blue-400' },
            { value: stats.bookings.completed, color: 'bg-green-400' },
            { value: stats.bookings.cancelled, color: 'bg-red-400' },
          ].map((s, i) => (
            s.value > 0 && (
              <div
                key={i}
                className={`h-full ${s.color} transition-all`}
                style={{ width: `${(s.value / stats.bookings.total) * 100}%` }}
              />
            )
          ))}
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Monthly Revenue (PKR)</p>
          <div className="flex items-end gap-2 h-32">
            {stats.monthlyData.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-xs text-muted-foreground rotate-0 truncate w-full text-center">
                  {d.revenue > 0 ? `${Math.round(d.revenue / 1000)}k` : ''}
                </p>
                <div
                  className="w-full bg-primary rounded-t-sm transition-all min-h-[2px]"
                  style={{ height: `${Math.max(2, (d.revenue / maxRevenue) * 96)}px` }}
                />
                <p className="text-xs text-muted-foreground">{d.month}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bookings chart */}
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-sm font-semibold mb-4">Monthly Completed Bookings</p>
          <div className="flex items-end gap-2 h-32">
            {stats.monthlyData.map((d) => (
              <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                <p className="text-xs text-muted-foreground">
                  {d.bookings > 0 ? d.bookings : ''}
                </p>
                <div
                  className="w-full bg-blue-400 dark:bg-blue-600 rounded-t-sm transition-all min-h-[2px]"
                  style={{ height: `${Math.max(2, (d.bookings / maxBookings) * 96)}px` }}
                />
                <p className="text-xs text-muted-foreground">{d.month}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent bookings */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <p className="text-sm font-semibold">Recent Bookings</p>
          <Link
            href="/payload/admin/collections/bookings"
            className="text-xs text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-border">
          {stats.recentBookings.length === 0 && (
            <p className="text-sm text-muted-foreground px-5 py-4">No bookings yet.</p>
          )}
          {stats.recentBookings.map((b) => (
            <div key={b.id} className="px-5 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{b.bookingReference as string}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[b.status as string] ?? ''}`}>
                    {b.status as string}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {b.user?.fullName ?? '—'} · {b.service?.serviceName ?? '—'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold">
                  {b.finalPrice ? `PKR ${(b.finalPrice as number).toLocaleString()}` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(b.createdAt as string).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Quick Links</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { label: 'Payments', href: '/payload/admin/collections/payments' },
            { label: 'Slot Templates', href: '/payload/admin/collections/slot-templates' },
            { label: 'Reviews', href: '/payload/admin/collections/reviews' },
            { label: 'Booking Settings', href: '/payload/admin/globals/booking-settings' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg border border-border bg-card px-3 py-2.5 text-xs font-medium text-center hover:bg-accent transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function KpiCard({ label, value, sub, color }: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color ?? ''}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

function LoadingState() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-24 bg-muted rounded-xl" />)}
      </div>
      <div className="h-40 bg-muted rounded-xl" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48 bg-muted rounded-xl" />
        <div className="h-48 bg-muted rounded-xl" />
      </div>
    </div>
  )
}
