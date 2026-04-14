import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/session'

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    let session: Awaited<ReturnType<typeof requireAuth>>
    try {
      session = await requireAuth(payload)
    } catch (res) {
      return res as Response
    }

    const body = (await req.json()) as { code?: string }
    const code = body.code?.trim().toUpperCase()

    if (!code) {
      return Response.json({ error: 'code is required' }, { status: 400 })
    }

    const result = await payload.find({
      collection: 'vouchers',
      where: { code: { equals: code } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (result.docs.length === 0) {
      return Response.json({ valid: false, error: 'Voucher not found' }, { status: 200 })
    }

    const voucher = result.docs[0] as unknown as Record<string, unknown>

    // Must be assigned to the requesting user
    const assignedUserId =
      typeof voucher.assignedToUser === 'number'
        ? voucher.assignedToUser
        : (voucher.assignedToUser as { id: number } | null)?.id

    if (assignedUserId !== session.id) {
      return Response.json(
        { valid: false, error: 'This voucher is not assigned to your account' },
        { status: 200 },
      )
    }

    if (voucher.isUsed === true) {
      return Response.json(
        { valid: false, error: 'This voucher has already been used' },
        { status: 200 },
      )
    }

    const validUntil = voucher.validUntil as string | undefined
    if (validUntil && new Date(validUntil) < new Date()) {
      return Response.json(
        { valid: false, error: 'This voucher has expired' },
        { status: 200 },
      )
    }

    return Response.json({
      valid: true,
      voucher: {
        code: voucher.code,
        discountPercent: voucher.discountPercent,
        validUntil: voucher.validUntil,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
