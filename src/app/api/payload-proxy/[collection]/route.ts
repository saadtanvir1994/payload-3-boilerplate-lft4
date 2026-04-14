import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'
import type { CollectionSlug, Where } from 'payload'

// Collections that are readable without authentication (public data)
// Public — readable without authentication
const PUBLIC_COLLECTIONS = new Set(['services', 'service-variants', 'reviews'])

// Authenticated — requires valid session cookie
const AUTH_COLLECTIONS = new Set([
  'bookings',
  'payments',
  'membership-cards',
  'loyalty-transactions',
  'vouchers',
  'referral-logs',
  'notifications',
])

type RouteContext = {
  params: Promise<{ collection: string }>
}

export async function GET(req: NextRequest, context: RouteContext): Promise<Response> {
  try {
    const { collection } = await context.params

    // Only allow whitelisted collections through this proxy
    const isPublic = PUBLIC_COLLECTIONS.has(collection)
    const isAuth = AUTH_COLLECTIONS.has(collection)

    if (!isPublic && !isAuth) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    const payload = await getPayload({ config: configPromise })

    // Authenticated collections require a valid session
    if (isAuth) {
      const { getSession } = await import('@/lib/session')
      const session = await getSession(payload)
      if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { searchParams } = req.nextUrl
    const limit = Number(searchParams.get('limit') ?? '100')
    const page = Number(searchParams.get('page') ?? '1')
    const depth = Number(searchParams.get('depth') ?? '0')

    // Parse where clauses from query params — e.g. where[isActive][equals]=true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {}
    for (const [key, value] of searchParams.entries()) {
      if (!key.startsWith('where[')) continue
      // Parse where[field][operator]=value
      const match = key.match(/^where\[([^\]]+)\]\[([^\]]+)\]$/)
      if (match) {
        const [, field, operator] = match
        if (!where[field]) where[field] = {}
        ;(where[field] as Record<string, unknown>)[operator] =
          value === 'true' ? true : value === 'false' ? false : value
      }
    }

    const result = await payload.find({
      collection: collection as CollectionSlug,
      limit,
      page,
      depth,
      overrideAccess: true,
      ...(Object.keys(where).length > 0 ? { where: where as Where } : {}),
    })

    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}