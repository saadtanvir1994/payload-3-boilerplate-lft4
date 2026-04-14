/**
 * Referral reward logic for Alpha Wheels.
 *
 * issueReferralVoucher is called at the end of handleBookingCompleted.
 *
 * Flow:
 *  1. Look up the referred user's referredBy field
 *  2. Exit early if no referrer, or if referral-log already Rewarded
 *  3. Read discount % and expiry days from booking-settings global
 *  4. Create a vouchers record for the referrer
 *  5. Create / update the referral-logs record to Rewarded
 */

import type { BasePayload } from 'payload'

export async function issueReferralVoucher(
  referredUserId: number,
  bookingId: number,
  payload: BasePayload,
): Promise<void> {
  // ── 1. Fetch the referred user to get referredBy ──────────────────────────
  let referredUser: Record<string, unknown>
  try {
    referredUser = (await payload.findByID({
      collection: 'users',
      id: referredUserId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch (err) {
    payload.logger.error(
      `[referral] Could not fetch referredUser ${referredUserId}: ${String(err)}`,
    )
    return
  }

  const referrerId =
    typeof referredUser.referredBy === 'number'
      ? referredUser.referredBy
      : (referredUser.referredBy as { id: number } | null)?.id

  // No referral chain — nothing to do
  if (!referrerId) return

  // ── 2. Check existing referral-log ────────────────────────────────────────
  const existingLog = await payload.find({
    collection: 'referral-logs',
    where: {
      and: [
        { referrer: { equals: referrerId } },
        { referredUser: { equals: referredUserId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existingLog.docs.length > 0) {
    const logDoc = existingLog.docs[0] as unknown as Record<string, unknown>
    if (logDoc.status === 'Rewarded') {
      payload.logger.info(
        `[referral] Referral already rewarded for referrer=${referrerId} referredUser=${referredUserId} — skipping`,
      )
      return
    }
  }

  // ── 3. Read settings for discount % and expiry days ───────────────────────
  let discountPercent = 10
  let expiryDays = 30

  try {
    const settings = (await payload.findGlobal({
      slug: 'booking-settings',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    discountPercent =
      (settings.defaultReferralVoucherPercent as number | undefined) ?? 10
    expiryDays = (settings.voucherExpiryDays as number | undefined) ?? 30
  } catch {
    payload.logger.warn(
      '[referral] Could not fetch booking-settings — using defaults (10%, 30 days)',
    )
  }

  const validUntil = new Date()
  validUntil.setDate(validUntil.getDate() + expiryDays)

  // ── 4. Create voucher for referrer ────────────────────────────────────────
  let voucherId: number | undefined

  try {
    const voucher = (await payload.create({
      collection: 'vouchers',
      data: {
        assignedToUser: referrerId,
        discountPercent,
        validUntil: validUntil.toISOString(),
        isUsed: false,
        source: 'Referral',
        referralBooking: bookingId,
      },
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    voucherId = voucher.id as number

    payload.logger.info(
      `[referral] Voucher ${voucher.code as string} created for referrer=${referrerId}`,
    )
  } catch (err) {
    payload.logger.error(
      `[referral] Failed to create voucher for referrer=${referrerId}: ${String(err)}`,
    )
    return
  }

  // ── 5. Create or update referral-log ─────────────────────────────────────
  try {
    if (existingLog.docs.length > 0) {
      const logDoc = existingLog.docs[0] as unknown as Record<string, unknown>
      await payload.update({
        collection: 'referral-logs',
        id: logDoc.id as number,
        data: {
          status: 'Rewarded',
          referredUserFirstBooking: bookingId,
          voucherIssued: voucherId,
        },
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'referral-logs',
        data: {
          referrer: referrerId,
          referredUser: referredUserId,
          referredUserFirstBooking: bookingId,
          voucherIssued: voucherId,
          status: 'Rewarded',
        },
        overrideAccess: true,
      })
    }

    payload.logger.info(
      `[referral] Referral log updated to Rewarded for referrer=${referrerId} referredUser=${referredUserId}`,
    )
  } catch (err) {
    payload.logger.error(
      `[referral] Failed to update referral-log: ${String(err)}`,
    )
  }
}
