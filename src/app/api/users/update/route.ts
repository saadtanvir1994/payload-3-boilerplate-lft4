import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

import { requireAuth } from '@/lib/session'

export async function PATCH(req: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    let session: Awaited<ReturnType<typeof requireAuth>>
    try {
      session = await requireAuth(payload)
    } catch (res) {
      return res as Response
    }

    const body = (await req.json()) as {
      fullName?: string
      whatsappNumber?: string
    }

    const updateData: Record<string, string> = {}

    if (body.fullName !== undefined) {
      const trimmed = body.fullName.trim()
      if (trimmed.length === 0) {
        return Response.json({ error: 'fullName cannot be empty' }, { status: 400 })
      }
      updateData.fullName = trimmed
    }

    if (body.whatsappNumber !== undefined) {
      const trimmed = body.whatsappNumber.trim()
      if (trimmed.length > 0 && !/^\d{10,15}$/.test(trimmed)) {
        return Response.json(
          { error: 'whatsappNumber must be digits only, 10-15 characters' },
          { status: 400 },
        )
      }
      updateData.whatsappNumber = trimmed
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json(
        { error: 'Provide at least one field to update: fullName or whatsappNumber' },
        { status: 400 },
      )
    }

    const updated = (await payload.update({
      collection: 'users',
      id: session.id,
      data: updateData,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    return Response.json({
      success: true,
      user: {
        id: updated.id,
        fullName: updated.fullName,
        whatsappNumber: updated.whatsappNumber,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}
