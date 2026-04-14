'use client'

import React, { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface BookingDetail {
  id: number
  bookingReference: string
  status: string
  location: string
  doorstepAddress?: string
  carModel: string
  carYear: string
  carColor: string
  originalPrice?: number
  discountAmount?: number
  finalPrice?: number
  loyaltyPointsEarned?: number
  cancellationRequestedBy?: string
  cancellationReason?: string
  createdAt: string
  service?: { serviceName?: string }
  slot?: { date?: string; startTime?: string; endTime?: string }
  payment?: { status?: string; method?: string; amount?: number }
}

const STATUS_STYLES: Record<string, string> = {
  Pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [booking, setBooking] = useState<BookingDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelForm, setShowCancelForm] = useState(false)
  const [cancelSuccess, setCancelSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/payload-proxy/bookings?where[id][equals]=${id}&depth=2&limit=1`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((d: { docs?: BookingDetail[] }) => {
        if (d.docs?.[0]) setBooking(d.docs[0])
        else router.replace('/my/bookings')
      })
      .catch(() => router.replace('/my/bookings'))
      .finally(() => setLoading(false))
  }, [id, router])

  async function handleCancelRequest() {
    if (!booking || !cancelReason.trim()) {
      setError('Please provide a reason for cancellation.')
      return
    }
    setError(null)
    setCancelling(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: cancelReason }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Failed to request cancellation'); return }
      setCancelSuccess(true)
      setShowCancelForm(false)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) return <div className="animate-pulse space-y-4"><div className="h-8 w-40 bg-muted rounded" /><div className="h-64 bg-muted rounded-xl" /></div>
  if (!booking) return null

  const slot = booking.slot
  const slotDate = slot?.date ? String(slot.date).slice(0, 10) : null
  const canCancel = ['Pending', 'Approved'].includes(booking.status) && !booking.cancellationRequestedBy

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/my/bookings" className="text-muted-foreground hover:text-foreground text-sm">← Back</Link>
        <h1 className="text-xl font-bold">{booking.bookingReference}</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[booking.status] ?? ''}`}>
          {booking.status}
        </span>
      </div>

      {/* Details card */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {[
          ['Service', booking.service?.serviceName ?? '—'],
          ['Date', slotDate ? new Date(`${slotDate}T00:00:00`).toLocaleDateString('en-PK', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : '—'],
          ['Time', slot?.startTime ? `${slot.startTime} – ${slot.endTime ?? ''}` : '—'],
          ['Location', booking.location],
          ...(booking.doorstepAddress ? [['Address', booking.doorstepAddress]] : []),
          ['Car', `${booking.carModel} ${booking.carYear} (${booking.carColor})`],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-sm font-medium text-right max-w-[60%] break-words">{value}</span>
          </div>
        ))}
      </div>

      {/* Payment card */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        <div className="px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
        </div>
        {booking.originalPrice && booking.discountAmount && booking.discountAmount > 0 && (
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-muted-foreground">Original Price</span>
            <span className="text-sm line-through text-muted-foreground">PKR {booking.originalPrice.toLocaleString()}</span>
          </div>
        )}
        {booking.discountAmount && booking.discountAmount > 0 && (
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-muted-foreground">Discount</span>
            <span className="text-sm text-green-600 dark:text-green-400">−PKR {booking.discountAmount.toLocaleString()}</span>
          </div>
        )}
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm font-semibold">Final Amount</span>
          <span className="text-sm font-bold">PKR {booking.finalPrice?.toLocaleString() ?? '—'}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-muted-foreground">Payment Status</span>
          <span className="text-sm font-medium">{booking.payment?.status ?? 'Pending'}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3">
          <span className="text-sm text-muted-foreground">Method</span>
          <span className="text-sm font-medium">{booking.payment?.method ?? '—'}</span>
        </div>
        {booking.loyaltyPointsEarned && booking.loyaltyPointsEarned > 0 && (
          <div className="flex justify-between items-center px-4 py-3">
            <span className="text-sm text-muted-foreground">Points Earned</span>
            <span className="text-sm font-medium text-primary">+{booking.loyaltyPointsEarned} pts</span>
          </div>
        )}
      </div>

      {/* Cancellation section */}
      {cancelSuccess && (
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
          ✅ Cancellation request submitted. Our team will review and contact you.
        </div>
      )}

      {booking.cancellationRequestedBy && !cancelSuccess && (
        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          ⏳ Cancellation request is pending admin review.
        </div>
      )}

      {canCancel && !showCancelForm && !cancelSuccess && (
        <button
          onClick={() => setShowCancelForm(true)}
          className="w-full py-2.5 px-4 rounded-md border border-destructive text-destructive text-sm font-medium hover:bg-destructive/10 transition-colors"
        >
          Request Cancellation
        </button>
      )}

      {showCancelForm && (
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold">Request Cancellation</p>
          <p className="text-xs text-muted-foreground">
            24+ hours before: full refund. Less than 24 hours: no refund.
          </p>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows={3}
            placeholder="Please provide a reason for cancellation…"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleCancelRequest}
              disabled={cancelling}
              className="flex-1 py-2 px-4 rounded-md bg-destructive text-destructive-foreground text-sm font-medium disabled:opacity-50"
            >
              {cancelling ? 'Submitting…' : 'Submit Request'}
            </button>
            <button
              onClick={() => { setShowCancelForm(false); setError(null) }}
              className="flex-1 py-2 px-4 rounded-md border border-border text-sm font-medium hover:bg-accent"
            >
              Keep Booking
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
