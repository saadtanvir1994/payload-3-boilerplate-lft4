import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/session'
import { sendNotification } from '@/lib/notifications'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(req: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    let session: Awaited<ReturnType<typeof requireAuth>>
    try {
      session = await requireAuth(payload)
    } catch (res) {
      return res as Response
    }

    const { id } = await context.params
    const bookingId = parseInt(id, 10)

    if (isNaN(bookingId)) {
      return Response.json({ error: 'Invalid booking id' }, { status: 400 })
    }

    const body = (await req.json().catch(() => ({}))) as { reason?: string }

    // Fetch the booking
    let booking: Record<string, unknown>
    try {
      booking = (await payload.findByID({
        collection: 'bookings',
        id: bookingId,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    // Customers can only cancel their own bookings
    const bookingUserId =
      typeof booking.user === 'number'
        ? booking.user
        : (booking.user as { id: number } | null)?.id

    if (session.role !== 'admin' && bookingUserId !== session.id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Only Pending or Approved bookings can be cancelled
    const status = booking.status as string
    if (status === 'Cancelled' || status === 'Completed') {
      return Response.json(
        { error: `Booking cannot be cancelled — current status is ${status}` },
        { status: 409 },
      )
    }

    // Set cancellation request fields
    await payload.update({
      collection: 'bookings',
      id: bookingId,
      data: {
        cancellationRequestedBy: 'user',
        cancellationReason: body.reason ?? '',
      },
      overrideAccess: true,
    })

    // Resolve context for admin alert
    const slotId =
      typeof booking.slot === 'number'
        ? booking.slot
        : (booking.slot as { id: number } | null)?.id

    let slotDate: string | undefined
    let slotStartTime: string | undefined
    let serviceName: string | undefined

    if (slotId) {
      try {
        const slot = (await payload.findByID({
          collection: 'slots',
          id: slotId,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Record<string, unknown>
        slotDate = slot.date ? String(slot.date).slice(0, 10) : undefined
        slotStartTime = slot.startTime as string | undefined
      } catch { /* non-fatal */ }
    }

    const serviceId =
      typeof booking.service === 'number'
        ? booking.service
        : (booking.service as { id: number } | null)?.id

    if (serviceId) {
      try {
        const svc = (await payload.findByID({
          collection: 'services',
          id: serviceId,
          depth: 0,
          overrideAccess: true,
        })) as unknown as Record<string, unknown>
        serviceName = svc.serviceName as string | undefined
      } catch { /* non-fatal */ }
    }

    // Send Cancellation Request Alert to admin
    await sendNotification({
      payload,
      type: 'Cancellation Request Alert',
      recipientType: 'admin',
      context: {
        customerName: session.fullName,
        bookingReference: booking.bookingReference as string | undefined,
        serviceName,
        slotDate,
        slotStartTime,
        cancellationReason: body.reason,
      },
    })

    return Response.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
