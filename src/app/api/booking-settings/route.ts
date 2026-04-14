import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function GET(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    const settings = (await payload.findGlobal({
      slug: 'booking-settings',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    const bankAccountDetails = settings.bankAccountDetails as Record<string, unknown> | undefined

    return Response.json({
      bankAccountDetails: bankAccountDetails ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
