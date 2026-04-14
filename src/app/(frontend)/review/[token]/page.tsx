'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'

interface ReviewData {
  id: number
  reviewToken: string
  tokenUsed: boolean
  tokenExpiresAt: string
  carPhotoByAdmin?: { url?: string } | null
  booking?: {
    bookingReference?: string
    carModel?: string
    carYear?: string
    service?: { serviceName?: string }
  }
}

export default function ReviewPage() {
  const { token } = useParams<{ token: string }>()
  const [review, setReview] = useState<ReviewData | null>(null)
  const [status, setStatus] = useState<'loading' | 'valid' | 'used' | 'expired' | 'invalid' | 'done'>('loading')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return

    fetch(`/api/payload-proxy/reviews?where[reviewToken][equals]=${token}&limit=1&depth=2`)
      .then((r) => r.json())
      .then((d: { docs?: ReviewData[] }) => {
        const doc = d.docs?.[0]
        if (!doc) { setStatus('invalid'); return }
        if (doc.tokenUsed) { setStatus('used'); return }
        if (new Date(doc.tokenExpiresAt) < new Date()) { setStatus('expired'); return }
        setReview(doc)
        setStatus('valid')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  async function handleSubmit() {
    if (!token || rating === 0) { setError('Please select a star rating'); return }
    setError(null)
    setSubmitting(true)

    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, rating, reviewText }),
      })
      const data = (await res.json()) as { success?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? 'Submission failed'); return }
      setStatus('done')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── States ────────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <PageShell>
        <div className="text-center py-12 text-muted-foreground animate-pulse">Loading…</div>
      </PageShell>
    )
  }

  if (status === 'invalid') {
    return (
      <PageShell>
        <MessageCard icon="❌" title="Invalid Token" body="This review link is not valid. Please contact Alpha Wheels." />
      </PageShell>
    )
  }

  if (status === 'used') {
    return (
      <PageShell>
        <MessageCard icon="✅" title="Already Submitted" body="This review has already been submitted. Thank you for your feedback!" />
      </PageShell>
    )
  }

  if (status === 'expired') {
    return (
      <PageShell>
        <MessageCard icon="⏰" title="Link Expired" body="This review link has expired. Please ask our team to generate a new one." />
      </PageShell>
    )
  }

  if (status === 'done') {
    return (
      <PageShell>
        <div className="text-center py-8 space-y-4">
          <div className="text-5xl">⭐</div>
          <h2 className="text-xl font-bold">Thank You!</h2>
          <p className="text-muted-foreground text-sm">
            Your review has been submitted. We really appreciate your feedback!
          </p>
          <p className="text-sm text-muted-foreground">
            A thank-you message has been sent to your WhatsApp.
          </p>
        </div>
      </PageShell>
    )
  }

  const booking = review?.booking
  const carPhoto = review?.carPhotoByAdmin

  return (
    <PageShell>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold">Leave a Review</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {booking?.bookingReference} · {booking?.service?.serviceName ?? 'Car Service'}
          </p>
        </div>

        {/* Car photo */}
        {carPhoto?.url && (
          <div className="rounded-xl overflow-hidden border border-border">
            <img src={carPhoto.url} alt="Your car after service" className="w-full h-48 object-cover" />
            <p className="text-xs text-center text-muted-foreground py-2">Your car after service</p>
          </div>
        )}

        {/* Car details */}
        {booking && (
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {booking.carModel} {booking.carYear}
            </p>
          </div>
        )}

        {/* Star rating */}
        <div className="space-y-2">
          <p className="text-sm font-medium">How would you rate your experience?</p>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
                className="text-3xl transition-transform hover:scale-110"
              >
                {star <= (hoverRating || rating) ? '⭐' : '☆'}
              </button>
            ))}
          </div>
          {rating > 0 && (
            <p className="text-sm text-muted-foreground">
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
            </p>
          )}
        </div>

        {/* Review text */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Your Review (optional)</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            rows={4}
            placeholder="Tell us about your experience…"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
          />
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="w-full py-2.5 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>

        <p className="text-xs text-center text-muted-foreground">
          This link is single-use and expires after submission.
        </p>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-card">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">AW</span>
          </div>
          <div>
            <p className="font-semibold text-sm">Alpha Wheels</p>
            <p className="text-muted-foreground text-xs">Service Review</p>
          </div>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-8">{children}</div>
    </div>
  )
}

function MessageCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="text-center py-12 space-y-3">
      <p className="text-4xl">{icon}</p>
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  )
}
