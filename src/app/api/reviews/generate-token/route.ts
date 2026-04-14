import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

import { requireAdmin } from '@/lib/session'
import { sendNotification } from '@/lib/notifications'

function generateReviewToken(): string {
  const digits = Math.floor(1000 + Math.random() * 9000).toString()
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const suffix =
    chars.charAt(Math.floor(Math.random() * chars.length)) +
    chars.charAt(Math.floor(Math.random() * chars.length))
  return `SVC-${digits}-${suffix}`
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    try {
      await requireAdmin(payload)
    } catch (res) {
      return res as Response
    }

    const body = (await req.json()) as { reviewId?: number }

    if (!body.reviewId) {
      return Response.json({ error: 'reviewId is required' }, { status: 400 })
    }

    // Fetch the review record
    let review: Record<string, unknown>
    try {
      review = (await payload.findByID({
        collection: 'reviews',
        id: body.reviewId,
        depth: 1,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Review record not found' }, { status: 404 })
    }

    // Admin must have uploaded the car photo first
    if (!review.carPhotoByAdmin) {
      return Response.json(
        { error: 'Please upload the car photo before generating the review token' },
        { status: 400 },
      )
    }

    // Don't re-generate if already submitted
    if (review.tokenUsed === true) {
      return Response.json(
        { error: 'This review has already been submitted' },
        { status: 409 },
      )
    }

    // Read expiry from booking-settings global
    let expiryMinutes = 2880 // default 48 hours
    try {
      const settings = (await payload.findGlobal({
        slug: 'booking-settings',
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
      expiryMinutes =
        (settings.reviewTokenExpiryMinutes as number | undefined) ?? 2880
    } catch { /* use default */ }

    const token = generateReviewToken()
    const tokenExpiresAt = new Date(
      Date.now() + expiryMinutes * 60 * 1000,
    ).toISOString()

    await payload.update({
      collection: 'reviews',
      id: body.reviewId,
      data: { reviewToken: token, tokenExpiresAt },
      overrideAccess: true,
    })

    // Build review link
    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:3000'
    const reviewLink = `${baseUrl}/review/${token}`

    // Resolve customer from linked user
    const userId =
      typeof review.user === 'number'
        ? review.user
        : (review.user as { id: number } | null)?.id

    if (userId) {
      await sendNotification({
        payload,
        type: 'Review Thanks',
        recipientType: 'customer',
        userId,
        context: { reviewLink },
      })
    }

    return Response.json({ success: true, token, reviewLink })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
