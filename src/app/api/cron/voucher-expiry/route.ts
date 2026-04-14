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

    const today = new Date().toISOString().slice(0, 10)

    // Find all unused vouchers whose validUntil date has passed
    const expired = await payload.find({
      collection: 'vouchers',
      where: {
        and: [
          { isUsed: { equals: false } },
          { validUntil: { less_than: today } },
        ],
      },
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })

    let processed = 0

    for (const doc of expired.docs as unknown as Array<Record<string, unknown>>) {
      // Log the expiry — vouchers are not deleted, just recorded
      payload.logger.info(
        `[cron/voucher-expiry] Expired voucher id=${doc.id} code=${doc.code as string}`,
      )
      processed++
    }

    return Response.json({ success: true, processed })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
