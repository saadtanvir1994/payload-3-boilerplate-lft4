/**
 * Membership & loyalty logic for Alpha Wheels.
 *
 * handleBookingCompleted is called by Bookings.afterChange when status → Completed.
 *
 * Flow:
 *  1. Fetch booking + related service
 *  2. Find or create membership-card for the user
 *  3. Increment service counts
 *  4. Check membership-tiers global for tier upgrade
 *  5. Check free slot threshold
 *  6. Calculate and award loyalty points
 *  7. Create loyalty-transactions record
 *  8. Call issueReferralVoucher (lib/referral.ts — stub until Module 6)
 */

import type { BasePayload } from 'payload'
import { sendNotification } from './notifications'
import { issueReferralVoucher } from './referral'

// ─── Tier shape ───────────────────────────────────────────────────────────────

interface TierConfig {
  tierName: string
  unlocksAtServiceCount: number
  freeSlotAtCycleCount: number
  pointsMultiplier: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves the tier multiplier for a given tier name from booking-settings global.
 * Falls back to the value from membership-tiers if booking-settings entry is missing.
 */
function getMultiplierFromSettings(
  tierName: string,
  settings: Record<string, unknown>,
): number {
  const multipliers = settings.loyaltyPointsMultipliers as Record<string, unknown> | undefined
  if (!multipliers) return 1

  if (tierName === 'Beginner') return (multipliers.beginnerMultiplier as number | undefined) ?? 1
  if (tierName === 'Gold') return (multipliers.goldMultiplier as number | undefined) ?? 1.5
  if (tierName === 'Platinum') return (multipliers.platinumMultiplier as number | undefined) ?? 2

  return 1
}

/**
 * Determines the highest tier the user qualifies for based on totalServicesEver.
 * Returns the matching TierConfig or null if no upgrade applies.
 */
function resolveNewTier(
  totalServicesEver: number,
  currentTier: string,
  tiers: TierConfig[],
): TierConfig | null {
  // Sort descending by threshold so we match the highest qualifying tier first
  const sorted = [...tiers].sort((a, b) => b.unlocksAtServiceCount - a.unlocksAtServiceCount)

  // Determine rank of the current tier so we only upgrade, never downgrade
  const currentRank = tiers.find((t) => t.tierName === currentTier)?.unlocksAtServiceCount ?? 0

  for (const tier of sorted) {
    if (
      tier.unlocksAtServiceCount > 0 &&
      totalServicesEver >= tier.unlocksAtServiceCount &&
      tier.tierName !== currentTier &&
      tier.unlocksAtServiceCount > currentRank
    ) {
      return tier
    }
  }

  return null
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function handleBookingCompleted(
  bookingId: number,
  payload: BasePayload,
): Promise<void> {
  // ── 1. Fetch booking ────────────────────────────────────────────────────────
  let booking: Record<string, unknown>
  try {
    booking = (await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      depth: 1,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch (err) {
    payload.logger.error(
      `[membership] Could not fetch booking ${bookingId}: ${String(err)}`,
    )
    return
  }

  const userId =
    typeof booking.user === 'number'
      ? booking.user
      : (booking.user as { id: number } | null)?.id

  if (!userId) {
    payload.logger.error(`[membership] No userId on booking ${bookingId}`)
    return
  }

  // ── 2. Fetch base loyalty points from service ────────────────────────────────
  let basePoints = 100
  try {
    const serviceId =
      typeof booking.service === 'number'
        ? booking.service
        : (booking.service as { id: number } | null)?.id

    if (serviceId) {
      const service = (await payload.findByID({
        collection: 'services',
        id: serviceId,
        depth: 0,
        overrideAccess: true,
      })) as unknown as Record<string, unknown>
      basePoints = (service.loyaltyPointsAwarded as number | undefined) ?? 100
    }
  } catch {
    payload.logger.warn(`[membership] Could not fetch service for booking ${bookingId} — using default 100 points`)
  }

  // ── 3. Fetch booking-settings and membership-tiers globals ──────────────────
  let settings: Record<string, unknown> = {}
  let tierConfigs: TierConfig[] = []

  try {
    settings = (await payload.findGlobal({
      slug: 'booking-settings',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    payload.logger.warn('[membership] Could not fetch booking-settings — using defaults')
  }

  try {
    const tiersGlobal = (await payload.findGlobal({
      slug: 'membership-tiers',
      overrideAccess: true,
    })) as unknown as Record<string, unknown>

    tierConfigs = ((tiersGlobal.tiers as TierConfig[] | undefined) ?? [])
  } catch {
    payload.logger.warn('[membership] Could not fetch membership-tiers — skipping tier logic')
  }

  // ── 4. Find or create membership-card ───────────────────────────────────────
  let card: Record<string, unknown>

  const existingCards = await payload.find({
    collection: 'membership-cards',
    where: { user: { equals: userId } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existingCards.docs.length > 0) {
    card = existingCards.docs[0] as unknown as Record<string, unknown>
  } else {
    card = (await payload.create({
      collection: 'membership-cards',
      data: {
        user: userId,
        currentTier: 'Beginner',
        servicesCompletedInCycle: 0,
        totalServicesEver: 0,
        freeSlotUnlocked: false,
        freeSlotUsed: false,
        cycleStartDate: new Date().toISOString(),
      },
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  }

  const cardId = card.id as number
  const currentTier = (card.currentTier as string | undefined) ?? 'Beginner'
  const prevServicesInCycle = (card.servicesCompletedInCycle as number | undefined) ?? 0
  const prevTotalEver = (card.totalServicesEver as number | undefined) ?? 0

  const newServicesInCycle = prevServicesInCycle + 1
  const newTotalEver = prevTotalEver + 1

  // ── 5. Check for tier upgrade ────────────────────────────────────────────────
  let activeTier = currentTier
  const upgradedTier = resolveNewTier(newTotalEver, currentTier, tierConfigs)

  if (upgradedTier) {
    activeTier = upgradedTier.tierName

    // Update membership-card tier
    await payload.update({
      collection: 'membership-cards',
      id: cardId,
      data: { currentTier: activeTier as 'Beginner' | 'Gold' | 'Platinum' },
      overrideAccess: true,
    })

    // Update user tier
    await payload.update({
      collection: 'users',
      id: userId,
      data: { currentTier: activeTier as 'Beginner' | 'Gold' | 'Platinum' },
      overrideAccess: true,
    })

    // Notify customer
    await sendNotification({
      payload,
      type: 'Tier Upgrade',
      recipientType: 'customer',
      userId,
      context: { tierName: activeTier },
    })

    payload.logger.info(
      `[membership] User ${userId} upgraded to ${activeTier} after ${newTotalEver} services`,
    )
  }

  // ── 6. Check free slot threshold ─────────────────────────────────────────────
  const activeTierConfig = tierConfigs.find((t) => t.tierName === activeTier)
  const freeSlotThreshold = activeTierConfig?.freeSlotAtCycleCount ?? 5

  let finalServicesInCycle = newServicesInCycle
  let freeSlotUnlocked = (card.freeSlotUnlocked as boolean | undefined) ?? false

  if (newServicesInCycle >= freeSlotThreshold) {
    freeSlotUnlocked = true
    finalServicesInCycle = 0 // Reset cycle

    await sendNotification({
      payload,
      type: 'Free Slot Unlocked',
      recipientType: 'customer',
      userId,
    })

    payload.logger.info(
      `[membership] Free slot unlocked for user ${userId} after ${newServicesInCycle} services in cycle`,
    )
  }

  // ── 7. Update membership-card counts ─────────────────────────────────────────
  await payload.update({
    collection: 'membership-cards',
    id: cardId,
    data: {
      servicesCompletedInCycle: finalServicesInCycle,
      totalServicesEver: newTotalEver,
      freeSlotUnlocked,
    },
    overrideAccess: true,
  })

  // ── 8. Calculate and award loyalty points ────────────────────────────────────
  const multiplier = getMultiplierFromSettings(activeTier, settings)
  const pointsEarned = Math.round(basePoints * multiplier)

  // Fetch current balance and add points
  let currentBalance = 0
  try {
    const user = (await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    currentBalance = (user.loyaltyPointsBalance as number | undefined) ?? 0
  } catch {
    // Non-fatal — proceed with balance 0
  }

  await payload.update({
    collection: 'users',
    id: userId,
    data: { loyaltyPointsBalance: currentBalance + pointsEarned },
    overrideAccess: true,
  })

  // Update booking with points earned
  await payload.update({
    collection: 'bookings',
    id: bookingId,
    data: { loyaltyPointsEarned: pointsEarned },
    overrideAccess: true,
  })

  // ── 9. Create loyalty-transactions record ─────────────────────────────────────
  await payload.create({
    collection: 'loyalty-transactions',
    data: {
      user: userId,
      booking: bookingId,
      pointsEarned,
      tierMultiplierApplied: multiplier,
      transactionDate: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  payload.logger.info(
    `[membership] Awarded ${pointsEarned} points to user ${userId} (${activeTier} ×${multiplier})`,
  )

  // ── 10. Issue referral voucher if applicable ──────────────────────────────────
  await issueReferralVoucher(userId, bookingId, payload)
}