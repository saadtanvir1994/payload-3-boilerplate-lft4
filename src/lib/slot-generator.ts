/**
 * Slot Generator
 *
 * Called by SlotTemplates.afterChange when isActive === true.
 * Generates individual Slot records from today up to generateUntilDate
 * for the given dayOfWeek, iterating in slotIntervalMinutes steps.
 *
 * Deduplication: skips any (date + startTime) that already exists.
 */

import type { BasePayload } from 'payload'

// Map spec dayOfWeek values to JS Date.getDay() numbers (0 = Sunday)
const DAY_OF_WEEK_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

/**
 * Parses an "HH:MM" string into { hours, minutes }.
 */
function parseTime(hhmm: string): { hours: number; minutes: number } {
  const [h, m] = hhmm.split(':').map(Number)
  return { hours: h ?? 0, minutes: m ?? 0 }
}

/**
 * Converts total minutes-since-midnight to "HH:MM" string.
 */
function minutesToHHMM(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Returns a YYYY-MM-DD string from a Date (local date, no timezone shift).
 */
function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Computes the dayOfWeek label from a YYYY-MM-DD string.
 */
export function computeDayOfWeek(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`)
  const dayIndex = date.getDay()
  const entry = Object.entries(DAY_OF_WEEK_MAP).find(([, v]) => v === dayIndex)
  return entry ? entry[0] : 'Mon'
}

interface SlotTemplateDoc {
  dayOfWeek: string
  startTime: string
  endTime: string
  slotIntervalMinutes?: number | null
  generateUntilDate: string
}

export async function generateSlotsFromTemplate(
  template: SlotTemplateDoc,
  payload: BasePayload,
): Promise<void> {
  const targetDayIndex = DAY_OF_WEEK_MAP[template.dayOfWeek]

  if (targetDayIndex === undefined) {
    payload.logger.error(
      `[slot-generator] Unknown dayOfWeek value: ${template.dayOfWeek}`,
    )
    return
  }

  const intervalMinutes = template.slotIntervalMinutes ?? 60

  const startParsed = parseTime(template.startTime)
  const endParsed = parseTime(template.endTime)

  const startTotalMinutes = startParsed.hours * 60 + startParsed.minutes
  const endTotalMinutes = endParsed.hours * 60 + endParsed.minutes

  if (startTotalMinutes >= endTotalMinutes) {
    payload.logger.error(
      `[slot-generator] startTime (${template.startTime}) must be before endTime (${template.endTime})`,
    )
    return
  }

  // Collect all target dates from today up to generateUntilDate
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const until = new Date(`${template.generateUntilDate}T00:00:00`)
  until.setHours(0, 0, 0, 0)

  if (until < today) {
    payload.logger.warn(
      `[slot-generator] generateUntilDate (${template.generateUntilDate}) is in the past — nothing to generate`,
    )
    return
  }

  // Build list of all matching dates
  const targetDates: string[] = []
  const cursor = new Date(today)

  while (cursor <= until) {
    if (cursor.getDay() === targetDayIndex) {
      targetDates.push(toDateString(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  if (targetDates.length === 0) {
    payload.logger.info(
      `[slot-generator] No matching dates found for dayOfWeek=${template.dayOfWeek}`,
    )
    return
  }

  // Fetch all existing slots for these dates to enable deduplication in memory
  const existingSlots = await payload.find({
    collection: 'slots',
    where: {
      date: {
        in: targetDates,
      },
    },
    limit: 0, // 0 = no limit — fetch all
    depth: 0,
    overrideAccess: true,
  })

  // Build a Set of "YYYY-MM-DD|HH:MM" keys for O(1) lookup
  const existingKeys = new Set<string>(
    existingSlots.docs.map((s) => `${s.date}|${s.startTime}`),
  )

  let created = 0
  let skipped = 0

  for (const dateStr of targetDates) {
    // Iterate time windows for this date
    let slotStart = startTotalMinutes

    while (slotStart < endTotalMinutes) {
      const slotEnd = slotStart + intervalMinutes

      // Don't create a slot that extends beyond endTime
      if (slotEnd > endTotalMinutes) break

      const startHHMM = minutesToHHMM(slotStart)
      const endHHMM = minutesToHHMM(slotEnd)
      const key = `${dateStr}|${startHHMM}`

      if (existingKeys.has(key)) {
        skipped++
      } else {
        await payload.create({
          collection: 'slots',
          data: {
            date: dateStr,
            startTime: startHHMM,
            endTime: endHHMM,
            dayOfWeek: template.dayOfWeek as 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun',
            isAvailable: true,
            isBlockedByAdmin: false,
            maxBookings: 1,
            currentBookingCount: 0,
          },
          overrideAccess: true,
        })

        existingKeys.add(key) // prevent duplicates within the same generation run
        created++
      }

      slotStart += intervalMinutes
    }
  }

  payload.logger.info(
    `[slot-generator] dayOfWeek=${template.dayOfWeek}: created=${created} skipped=${skipped}`,
  )
}