/**
 * Session helpers for Alpha Wheels.
 *
 * We issue our own JWT (via verify-otp) because customers authenticate
 * via WhatsApp OTP, not email/password. We verify this JWT directly
 * rather than going through payload.auth(), which requires an email
 * match that may not align with our synthetic email addresses.
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
  id: number
  email: string
  collection: string
}

/**
 * Returns the authenticated user from the payload-token cookie,
 * or null if no valid session exists.
 *
 * Verifies the JWT directly with PAYLOAD_SECRET, then fetches the
 * user from the database to get fresh field values.
 */
export async function getSession(payload: BasePayload): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(PAYLOAD_COOKIE)?.value

    if (!token) return null

    const secret = process.env.PAYLOAD_SECRET
    if (!secret) return null

    // Verify signature and decode — throws if invalid or expired
    let decoded: JwtPayload
    try {
      decoded = jwt.verify(token, secret) as JwtPayload
    } catch {
      return null
    }

    if (!decoded.id) return null

    // Fetch fresh user data from DB
    const user = await payload.findByID({
      collection: 'users',
      id: decoded.id,
      depth: 0,
      overrideAccess: true,
    })

    if (!user) return null

    const u = user as unknown as Record<string, unknown>

    // Reject disabled accounts
    if (u.isActive === false) return null

    return {
      id: u.id as number,
      fullName: (u.fullName as string | undefined) ?? '',
      mobileNumber: u.mobileNumber as string | null | undefined,
      whatsappNumber: u.whatsappNumber as string | null | undefined,
      role: (u.role as string | undefined) ?? 'customer',
      currentTier: (u.currentTier as string | undefined) ?? 'Beginner',
      loyaltyPointsBalance: (u.loyaltyPointsBalance as number | undefined) ?? 0,
      isActive: (u.isActive as boolean | undefined) ?? true,
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