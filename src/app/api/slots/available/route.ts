import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { NextRequest } from 'next/server'

// ── POST /api/slots/available ─────────────────────────────────────────────────
// Body: { month: 'YYYY-MM' }
// Returns: array of date strings that have at least one available slot.
// Public — slot availability is not sensitive data.
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    const body = (await req.json()) as { month?: string }
    const month = body.month?.trim()

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return Response.json(
        { error: 'month is required in YYYY-MM format' },
        { status: 400 },
      )
    }

    // Build date range for the month
    const [year, monthNum] = month.split('-').map(Number)
    const lastDay = new Date(year, monthNum, 0)

    const pad = (n: number) => String(n).padStart(2, '0')
    const firstStr = `${year}-${pad(monthNum)}-01`
    const lastStr = `${year}-${pad(monthNum)}-${pad(lastDay.getDate())}`

    // Use a high limit — limit: 0 in Payload means "use default" (10), not "unlimited"
    const result = await payload.find({
      collection: 'slots',
      where: {
        and: [
          { date: { greater_than_equal: firstStr } },
          { date: { less_than_equal: lastStr } },
          { isAvailable: { equals: true } },
          { isBlockedByAdmin: { equals: false } },
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
    })

    // Payload stores date fields as full ISO strings e.g. "2025-04-14T00:00:00.000Z"
    // Slice to YYYY-MM-DD before deduplicating
    const dateSet = new Set<string>()
    for (const slot of result.docs as unknown as Array<Record<string, unknown>>) {
      if (slot.date) {
        dateSet.add(String(slot.date).slice(0, 10))
      }
    }

    return Response.json({ availableDates: Array.from(dateSet).sort() })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}

// ── GET /api/slots/available?date=YYYY-MM-DD ──────────────────────────────────
// Returns: array of available slot objects for the given date.
// Public — slot availability is not sensitive data.
export async function GET(req: NextRequest): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })

    const date = req.nextUrl.searchParams.get('date')

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return Response.json(
        { error: 'date query param is required in YYYY-MM-DD format' },
        { status: 400 },
      )
    }

    // Payload stores date fields as full ISO timestamps e.g. "2025-04-14T00:00:00.000Z"
    // Using equals: "2025-04-14" never matches "2025-04-14T00:00:00.000Z"
    // Fix: query with a range spanning the entire day instead
    const dayStart = date                  // "2025-04-14"
    const nextDate = new Date(`${date}T00:00:00.000Z`)
    nextDate.setUTCDate(nextDate.getUTCDate() + 1)
    const dayEnd = nextDate.toISOString().slice(0, 10)  // "2025-04-15"

    const result = await payload.find({
      collection: 'slots',
      where: {
        and: [
          { date: { greater_than_equal: dayStart } },
          { date: { less_than: dayEnd } },
          { isAvailable: { equals: true } },
          { isBlockedByAdmin: { equals: false } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })

    const slots = (result.docs as unknown as Array<Record<string, unknown>>).map((s) => ({
      id: s.id,
      startTime: s.startTime,
      endTime: s.endTime,
      date: String(s.date).slice(0, 10),
      maxBookings: s.maxBookings,
      currentBookingCount: s.currentBookingCount,
    }))

    return Response.json({ slots })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return Response.json({ error: message }, { status: 500 })
  }
}