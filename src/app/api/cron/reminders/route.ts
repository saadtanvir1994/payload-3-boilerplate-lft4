import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

import { validateCronSecret } from '@/lib/cron-auth'
import { sendNotification } from '@/lib/notifications'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  if (!validateCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config: configPromise })

    // Read reminderHoursBefore from booking-settings
    let reminderHoursBefore = 24
    try {
      const settings = (await payload.findGlobal({
        slug: 'booking-settings',
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
      reminderHoursBefore =
        (settings.reminderHoursBefore as number | undefined) ?? 24
    } catch { /* use default */ }

    const now = new Date()
    const windowStart = new Date(now.getTime() + reminderHoursBefore * 60 * 60 * 1000)
    const windowEnd = new Date(windowStart.getTime() + 60 * 60 * 1000) // 1-hour window

    const windowStartDate = windowStart.toISOString().slice(0, 10)
    const windowEndDate = windowEnd.toISOString().slice(0, 10)

    // Find all Approved bookings whose slot date falls within the window
    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        and: [
          { status: { equals: 'Approved' } },
          { whatsappAlertSent: { equals: false } },
        ],
      },
      limit: 0,
      depth: 2,
      overrideAccess: true,
    })

    let sent = 0
    let failed = 0

    for (const doc of bookings.docs as unknown as Array<Record<string, unknown>>) {
      // Resolve slot date from populated depth-2 slot
      const slot = doc.slot as Record<string, unknown> | null
      if (!slot || typeof slot !== 'object') continue

      const slotDateStr = slot.date ? String(slot.date).slice(0, 10) : null
      if (!slotDateStr) continue

      // Only remind if the slot date is within the window
      if (slotDateStr < windowStartDate || slotDateStr > windowEndDate) continue

      const userId =
        typeof doc.user === 'number'
          ? doc.user
          : (doc.user as { id: number } | null)?.id

      const service = doc.service as Record<string, unknown> | null
      const serviceName =
        service && typeof service === 'object'
          ? (service.serviceName as string | undefined)
          : undefined

      try {
        await sendNotification({
          payload,
          type: 'Reminder',
          recipientType: 'customer',
          userId: userId ?? undefined,
          context: {
            bookingReference: doc.bookingReference as string | undefined,
            serviceName,
            slotDate: slotDateStr,
            slotStartTime: slot.startTime as string | undefined,
            slotEndTime: slot.endTime as string | undefined,
            location: doc.location as string | undefined,
          },
        })

        // Mark reminder as sent
        await payload.update({
          collection: 'bookings',
          id: doc.id as number,
          data: { whatsappAlertSent: true },
          overrideAccess: true,
        })

        sent++
      } catch {
        failed++
      }
    }

    return Response.json({ success: true, sent, failed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
