/**
 * Validates the CRON_SECRET on incoming cron requests.
 * Accepts secret as query param ?secret=... or header x-cron-secret.
 */
import type { NextRequest } from 'next/server'

export function validateCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron-auth] CRON_SECRET env var is not set')
    return false
  }

  const fromQuery = req.nextUrl.searchParams.get('secret')
  const fromHeader = req.headers.get('x-cron-secret')

  return fromQuery === secret || fromHeader === secret
}
