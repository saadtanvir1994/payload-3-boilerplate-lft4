import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/session'

interface CreateBookingBody {
  serviceId?: number
  serviceVariantId?: number
  slotId?: number
  carModel?: string
  carYear?: string
  carColor?: string
  location?: 'Studio' | 'Doorstep'
  doorstepAddress?: string
  voucherCode?: string
  paymentMethod?: 'Bank Transfer' | 'Online'
  bankTransferReferenceNumber?: string
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    // Require authenticated customer
    let session: Awaited<ReturnType<typeof requireAuth>>
    try {
      session = await requireAuth(payload)
    } catch (res) {
      return res as Response
    }

    const body = (await req.json()) as CreateBookingBody

    // ── Validate required fields ──────────────────────────────────────────────
    const missing: string[] = []
    if (!body.serviceId) missing.push('serviceId')
    if (!body.serviceVariantId) missing.push('serviceVariantId')
    if (!body.slotId) missing.push('slotId')
    if (!body.carModel) missing.push('carModel')
    if (!body.carYear) missing.push('carYear')
    if (!body.carColor) missing.push('carColor')
    if (!body.location) missing.push('location')
    if (!body.paymentMethod) missing.push('paymentMethod')

    if (missing.length > 0) {
      return Response.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 },
      )
    }

    if (body.location === 'Doorstep' && !body.doorstepAddress) {
      return Response.json(
        { error: 'doorstepAddress is required when location is Doorstep' },
        { status: 400 },
      )
    }

    // ── Validate slot is still available ─────────────────────────────────────
    const slot = (await payload.findByID({
      collection: 'slots',
      id: body.slotId!,
      depth: 0,
      overrideAccess: true,
    }))  as unknown as Record<string, unknown>

    if (!slot) {
      return Response.json({ error: 'Slot not found' }, { status: 404 })
    }

    if (slot.isAvailable === false || slot.isBlockedByAdmin === true) {
      return Response.json(
        { error: 'This slot is no longer available. Please choose another time.' },
        { status: 409 },
      )
    }

    // ── Validate service variant and get price ────────────────────────────────
    const variant = (await payload.findByID({
      collection: 'service-variants',
      id: body.serviceVariantId!,
      depth: 0,
      overrideAccess: true,
    }))  as unknown as Record<string, unknown>

    if (!variant) {
      return Response.json({ error: 'Service variant not found' }, { status: 404 })
    }

    const basePrice = (variant.price as number | undefined) ?? 0

    // ── Validate and apply voucher ────────────────────────────────────────────
    let finalPrice = basePrice
    let discountAmount = 0
    let voucherId: number | undefined

    if (body.voucherCode) {
      const voucherResult = await payload.find({
        collection: 'vouchers',
        where: {
          and: [
            { code: { equals: body.voucherCode } },
            { assignedToUser: { equals: session.id } },
            { isUsed: { equals: false } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })

      if (voucherResult.docs.length === 0) {
        return Response.json(
          { error: 'Voucher is invalid, already used, or not assigned to your account.' },
          { status: 400 },
        )
      }

      const voucher = voucherResult.docs[0]  as unknown as Record<string, unknown>

      // Check expiry
      const validUntil = voucher.validUntil as string | undefined
      if (validUntil && new Date(validUntil) < new Date()) {
        return Response.json({ error: 'This voucher has expired.' }, { status: 400 })
      }

      const discountPercent = (voucher.discountPercent as number | undefined) ?? 10
      const discounted = Math.round(basePrice * (1 - discountPercent / 100))
      discountAmount = basePrice - discounted
      finalPrice = discounted
      voucherId = voucher.id as number

      // Mark voucher as used
      await payload.update({
        collection: 'vouchers',
        id: voucherId,
        data: { isUsed: true, usedAt: new Date().toISOString() },
        overrideAccess: true,
      })
    }

    // ── Create booking ────────────────────────────────────────────────────────
    const booking = (await payload.create({
      collection: 'bookings',
      data: {
        user: session.id,
        service: body.serviceId!,
        serviceVariant: body.serviceVariantId!,
        slot: body.slotId!,
        carModel: body.carModel!,
        carYear: body.carYear!,
        carColor: body.carColor!,
        location: body.location!,
        ...(body.doorstepAddress ? { doorstepAddress: body.doorstepAddress } : {}),
        status: 'Pending',
        originalPrice: basePrice,
        discountAmount,
        finalPrice,
        ...(voucherId ? { voucherApplied: voucherId } : {}),
      },
      overrideAccess: true,
    }))  as unknown as Record<string, unknown>

    // ── Create payment record ─────────────────────────────────────────────────
    const payment = (await payload.create({
      collection: 'payments',
      data: {
        booking: booking.id as number,
        method: body.paymentMethod!,
        amount: finalPrice,
        status: 'Pending',
        ...(body.bankTransferReferenceNumber
          ? { bankTransferReferenceNumber: body.bankTransferReferenceNumber }
          : {}),
      },
      overrideAccess: true,
    }))  as unknown as Record<string, unknown>

    // Link payment back to booking
    await payload.update({
      collection: 'bookings',
      id: booking.id as number,
      data: { payment: payment.id as number },
      overrideAccess: true,
    })

    // Fetch bank details to include in response — avoids a separate client fetch
    let bankAccountDetails: Record<string, unknown> | null = null
    try {
      const settings = (await payload.findGlobal({
        slug: 'booking-settings',
        overrideAccess: true,
      }))  as unknown as Record<string, unknown>
      bankAccountDetails = (settings.bankAccountDetails as Record<string, unknown> | undefined) ?? null
    } catch {
      // Non-fatal — client can still show booking confirmation without bank details
    }

    return Response.json(
      {
        success: true,
        booking: {
          id: booking.id,
          bookingReference: booking.bookingReference,
          status: booking.status,
          originalPrice: basePrice,
          discountAmount,
          finalPrice,
        },
        payment: {
          id: payment.id,
          status: payment.status,
        },
        bankAccountDetails,
      },
      { status: 201 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}