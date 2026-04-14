import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

import { validateCronSecret } from '@/lib/cron-auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  if (!validateCronSecret(req)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await getPayload({ config: configPromise })

    // Yesterday's date — do not touch today's slots
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const cutoff = yesterday.toISOString().slice(0, 10)

    // Find past slots with no bookings
    const stale = await payload.find({
      collection: 'slots',
      where: {
        and: [
          { date: { less_than_equal: cutoff } },
          { currentBookingCount: { equals: 0 } },
        ],
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })

    let deleted = 0

    for (const doc of stale.docs as unknown as Array<Record<string, unknown>>) {
      try {
        await payload.delete({
          collection: 'slots',
          id: doc.id as number,
          overrideAccess: true,
        })
        deleted++
      } catch (err) {
        payload.logger.error(
          `[cron/slot-cleanup] Failed to delete slot id=${doc.id}: ${String(err)}`,
        )
      }
    }

    return Response.json({ success: true, deleted })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
