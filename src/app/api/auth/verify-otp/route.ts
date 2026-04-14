import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

import { buildTokenCookie } from '@/lib/session'

const TOKEN_EXPIRY_SECONDS = 60 * 60 * 24 * 30 // 30 days

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = (await req.json()) as {
      mobileNumber?: string
      otp?: string
    }

    const mobileNumber = body.mobileNumber?.trim()
    const otp = body.otp?.trim()

    if (!mobileNumber || !otp) {
      return Response.json(
        { error: 'mobileNumber and otp are required' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config: configPromise })

    // Find user by mobileNumber
    const result = await payload.find({
      collection: 'users',
      where: { mobileNumber: { equals: mobileNumber } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (result.docs.length === 0) {
      return Response.json({ error: 'Invalid OTP' }, { status: 401 })
    }

const user = result.docs[0] as unknown as Record<string, unknown>;
    // Check account is active
    if (user.isActive === false) {
      return Response.json(
        { error: 'This account has been disabled.' },
        { status: 403 },
      )
    }

    // Validate OTP value
    if (!user.otp || user.otp !== otp) {
      return Response.json({ error: 'Invalid OTP' }, { status: 401 })
    }

    // Validate OTP expiry
    const expiresAt = user.otpExpiresAt
    if (!expiresAt || new Date(expiresAt as string) < new Date()) {
      return Response.json(
        { error: 'OTP has expired. Please request a new one.' },
        { status: 401 },
      )
    }

    // Clear OTP fields — single-use
    // Use empty string for text field (null causes Payload validation error),
    // and omit otpExpiresAt from update by setting to a past date string
    await payload.update({
      collection: 'users',
      id: user.id as number,
      data: { otp: '', otpExpiresAt: '1970-01-01T00:00:00.000Z' },
      overrideAccess: true,
    })

    // Issue JWT signed with PAYLOAD_SECRET — same format Payload uses internally
    const secret = process.env.PAYLOAD_SECRET
    if (!secret) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: (user.email as string | undefined) ?? `${mobileNumber}@alphawheels.local`,
        collection: 'users',
      },
      secret,
      { expiresIn: TOKEN_EXPIRY_SECONDS },
    )

    const cookieHeader = buildTokenCookie(token, TOKEN_EXPIRY_SECONDS)

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: user.id,
          fullName: user.fullName,
          mobileNumber: user.mobileNumber,
          role: user.role,
          currentTier: user.currentTier,
          loyaltyPointsBalance: user.loyaltyPointsBalance,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader,
        },
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}