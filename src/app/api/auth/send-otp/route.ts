import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

import { sendWhatsAppMessage, toChatId } from '@/lib/greenapi'

const OTP_EXPIRY_MINUTES = 10

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as {
      mobileNumber?: string
      referralCode?: string
      fullName?: string
    }

    const mobileNumber = body.mobileNumber?.trim()
    const referralCode = body.referralCode?.trim().toUpperCase()
    const fullName = body.fullName?.trim() || 'New Customer'

    if (!mobileNumber) {
      return Response.json({ error: 'mobileNumber is required' }, { status: 400 })
    }

    // Accept both local (03...) and international (923...) formats
    if (!/^\d{10,15}$/.test(mobileNumber)) {
      return Response.json(
        { error: 'mobileNumber must be digits only, 10-15 characters e.g. 923001234567' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config: configPromise })

    // Look up existing user
    const existing = await payload.find({
      collection: 'users',
      where: { mobileNumber: { equals: mobileNumber } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const otp = generateOtp()
    const otpExpiresAt = new Date(
      Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    ).toISOString()

    let userId: number | undefined

    if (existing.docs.length > 0) {
      const user = existing.docs[0]  as unknown as Record<string, unknown>

      if (user.isActive === false) {
        return Response.json(
          { error: 'This account has been disabled. Please contact support.' },
          { status: 403 },
        )
      }

      userId = user.id as number

      const existingFullName = (existing.docs[0]  as unknown as Record<string, unknown>).fullName as string | undefined
      await payload.update({
        collection: 'users',
        id: userId,
        data: {
          otp,
          otpExpiresAt,
          // Update name if it was auto-set
          ...(existingFullName === 'New Customer' && fullName !== 'New Customer'
            ? { fullName }
            : {}),
        },
        overrideAccess: true,
      })
    } else {
      // ── Resolve referral code → referredBy user id ──────────────────────────
      let referredById: number | undefined

      if (referralCode) {
        try {
          const referrerResult = await payload.find({
            collection: 'users',
            where: { referralCode: { equals: referralCode } },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          if (referrerResult.docs.length > 0) {
            const referrer = referrerResult.docs[0]  as unknown as Record<string, unknown>
            referredById = referrer.id as number
          } else {
            payload.logger.warn(`[send-otp] Referral code ${referralCode} not found — ignoring`)
          }
        } catch {
          // Non-fatal — proceed without referral
        }
      }

      // Auto-create new customer — beforeChange hook generates referralCode
      const newUser = (await payload.create({
        collection: 'users',
        data: {
          email: `${mobileNumber}@alphawheels.local`,
          mobileNumber,
          whatsappNumber: mobileNumber,
          fullName,
          role: 'customer',
          isActive: true,
          otp,
          otpExpiresAt,
          ...(referredById ? { referredBy: referredById } : {}),
          // Payload auth requires a password — customers never use it directly
          password: crypto.randomUUID(),
        },
        overrideAccess: true,
      }))  as unknown as Record<string, unknown>

      userId = newUser.id as number
    }

    // Build and send the OTP message
    const message =
      `Your Alpha Wheels verification code is: *${otp}*\n\n` +
      `This code expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share it with anyone.`

    const result = await sendWhatsAppMessage(toChatId(mobileNumber), message)

    if (!result.success) {
      payload.logger.error(
        `[send-otp] WhatsApp delivery failed for ${mobileNumber}: ${result.error ?? 'unknown'}`,
      )
    }

    // Log to notifications collection (best-effort, does NOT re-send)
    if (userId) {
      try {
        await payload.create({
          collection: 'notifications',
          data: {
            user: userId,
            type: 'OTP',
            channel: 'WhatsApp',
            messageBody: message,
            status: result.success ? 'Sent' : 'Failed',
            sentAt: new Date().toISOString(),
          },
          overrideAccess: true,
        })
      } catch {
        // Non-fatal
      }
    }

    return Response.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[send-otp] ERROR:', message)
    return Response.json({ error: message }, { status: 500 })
  }
}