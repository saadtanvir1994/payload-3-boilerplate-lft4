/**
 * Session helpers for Alpha Wheels.
 *
 * We issue our own JWT (via verify-otp) because customers authenticate
 * via WhatsApp OTP, not email/password. We verify this JWT directly
 * rather than going through payload.auth(), which requires an email
 * match that may not align with our synthetic email addresses.
 *
 * IMPORTANT: Payload's own admin panel also sets a 'payload-token' cookie
 * using the same PAYLOAD_SECRET. The difference is that Payload's token
 * encodes `id` as a string, while our OTP token encodes it as a number.
 * We normalise to number with parseInt() to handle both cases.
 */

import type { BasePayload } from 'payload'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const PAYLOAD_COOKIE = 'payload-token'

export interface SessionUser {
  id: number
  fullName: string
  mobileNumber: string | null | undefined
  whatsappNumber: string | null | undefined
  role: string
  currentTier: string
  loyaltyPointsBalance: number
  isActive: boolean
}

interface JwtPayload {
  // Payload's own admin tokens encode id as string; our OTP tokens as number
  id: number | string
  email: string
  collection: string
}

/**
 * Returns the authenticated user from the payload-token cookie,
 * or null if no valid session exists.
 */
export async function getSession(payload: BasePayload): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(PAYLOAD_COOKIE)?.value

    if (!token) return null

    const secret = process.env.PAYLOAD_SECRET
    if (!secret) return null

    // Verify signature and decode — returns null if invalid or expired
    let decoded: JwtPayload
    try {
      decoded = jwt.verify(token, secret) as JwtPayload
    } catch {
      // Token invalid, expired, or tampered
      return null
    }

    // Normalise id — Payload admin tokens encode id as string, ours as number
    const rawId = decoded.id
    const userId = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId
    if (!userId || isNaN(userId)) return null

    // Fetch fresh user data from DB
    let user: Record<string, unknown>
    try {
      user = (await payload.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
    } catch {
      // User not found or DB error
      return null
    }

    if (!user) return null

    // Reject disabled accounts
    if (user.isActive === false) return null

    return {
      id: user.id as number,
      fullName: (user.fullName as string | undefined) ?? '',
      mobileNumber: user.mobileNumber as string | null | undefined,
      whatsappNumber: user.whatsappNumber as string | null | undefined,
      role: (user.role as string | undefined) ?? 'customer',
      currentTier: (user.currentTier as string | undefined) ?? 'Beginner',
      loyaltyPointsBalance: (user.loyaltyPointsBalance as number | undefined) ?? 0,
      isActive: (user.isActive as boolean | undefined) ?? true,
    }
  } catch {
    return null
  }
}

/**
 * Returns the session user or throws a 401 Response.
 */
export async function requireAuth(payload: BasePayload): Promise<SessionUser> {
  const session = await getSession(payload)
  if (!session) {
    throw new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}

/**
 * Returns the session user only if they have role === 'admin'.
 * Throws a 403 Response otherwise.
 */
export async function requireAdmin(payload: BasePayload): Promise<SessionUser> {
  const session = await requireAuth(payload)
  if (session.role !== 'admin') {
    throw new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return session
}

/**
 * Builds the Set-Cookie header string for the payload-token.
 */
export function buildTokenCookie(token: string, expirySeconds: number): string {
  const expires = new Date(Date.now() + expirySeconds * 1000).toUTCString()
  return `${PAYLOAD_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}`
}

/**
 * Builds a Set-Cookie header that clears the payload-token.
 */
export function clearTokenCookie(): string {
  return `${PAYLOAD_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
}