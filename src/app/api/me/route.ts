import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { getSession } from '@/lib/session'

export async function GET(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    const session = await getSession(payload)

    if (!session) {
      return Response.json({ user: null }, { status: 200 })
    }

    return Response.json({ user: session }, { status: 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
