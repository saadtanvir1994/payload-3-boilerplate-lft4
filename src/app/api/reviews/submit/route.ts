import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

import { sendNotification } from '@/lib/notifications'

interface SubmitReviewBody {
  token?: string
  rating?: number
  reviewText?: string
  customerExtraImages?: Array<{ image: number }>
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    const body = (await req.json()) as SubmitReviewBody

    if (!body.token) {
      return Response.json({ error: 'token is required' }, { status: 400 })
    }

    if (!body.rating || body.rating < 1 || body.rating > 5) {
      return Response.json(
        { error: 'rating must be a number between 1 and 5' },
        { status: 400 },
      )
    }

    // Find review by token
    const result = await payload.find({
      collection: 'reviews',
      where: { reviewToken: { equals: body.token } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (result.docs.length === 0) {
      return Response.json({ error: 'Invalid review token' }, { status: 404 })
    }

    const review = result.docs[0] as unknown as Record<string, unknown>

    // Single-use check
    if (review.tokenUsed === true) {
      return Response.json(
        { error: 'This review token has already been used' },
        { status: 409 },
      )
    }

    // Expiry check
    const tokenExpiresAt = review.tokenExpiresAt as string | undefined
    if (!tokenExpiresAt || new Date(tokenExpiresAt) < new Date()) {
      return Response.json(
        { error: 'This review token has expired. Please contact Alpha Wheels.' },
        { status: 410 },
      )
    }

    // Submit the review
    await payload.update({
      collection: 'reviews',
      id: review.id as number,
      data: {
        rating: body.rating,
        reviewText: body.reviewText ?? '',
        tokenUsed: true,
        submittedAt: new Date().toISOString(),
        isVerified: true,
        ...(body.customerExtraImages && body.customerExtraImages.length > 0
          ? { customerExtraImages: body.customerExtraImages }
          : {}),
      },
      overrideAccess: true,
    })

    // Notify customer — Review Thanks
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
      })
    }

    return Response.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
