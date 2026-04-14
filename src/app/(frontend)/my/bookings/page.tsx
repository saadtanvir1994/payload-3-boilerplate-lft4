'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

interface Booking {
  id: number
  bookingReference: string
  status: string
  finalPrice?: number
  originalPrice?: number
  discountAmount?: number
  location: string
  carModel: string
  carYear: string
  createdAt: string
}

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const me = await fetch('/api/me', { credentials: 'include' }).then((r) => r.json()) as { user?: { id: number } }
        if (!me.user) return
        setUserId(me.user.id)

        const res = await fetch(
          `/api/payload-proxy/bookings?where[user][equals]=${me.user.id}&limit=50&sort=-createdAt&depth=1`,
          { credentials: 'include' },
        )
        const data = (await res.json()) as { docs?: Booking[] }
        setBookings(data.docs ?? [])
      } catch { /* non-fatal */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) return <div className="animate-pulse space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-lg" />)}</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My Bookings</h1>
        <Link href="/booking" className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-md font-medium">
          + New Booking
        </Link>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">No bookings yet</p>
          <p className="text-sm mt-1">Book your first service to get started.</p>
          <Link href="/booking" className="inline-block mt-4 text-sm text-primary hover:underline">
            Book a service →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((b) => (
            <Link
              key={b.id}
              href={`/my/bookings/${b.id}`}
              className="block rounded-lg border border-border bg-card p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{b.bookingReference}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[b.status] ?? ''}`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {b.carModel} {b.carYear} · {b.location}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(b.createdAt).toLocaleDateString('en-PK', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">PKR {b.finalPrice?.toLocaleString() ?? '—'}</p>
                  {b.discountAmount && b.discountAmount > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400">
                      −PKR {b.discountAmount.toLocaleString()} saved
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
