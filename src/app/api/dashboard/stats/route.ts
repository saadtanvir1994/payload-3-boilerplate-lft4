import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { requireAdmin } from '@/lib/session'

export async function GET(): Promise<Response> {
  try {
    const payload = await getPayload({ config: configPromise })
    try {
      await requireAdmin(payload)
    } catch (res) {
      return res as Response
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()

    const [allBookings, thisMonthBookings, lastMonthBookings,
           pending, approved, completed, cancelled] = await Promise.all([
      payload.find({ collection: 'bookings', limit: 0, overrideAccess: true }),
      payload.find({ collection: 'bookings', where: { createdAt: { greater_than_equal: startOfMonth } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'bookings', where: { and: [{ createdAt: { greater_than_equal: startOfLastMonth } }, { createdAt: { less_than_equal: endOfLastMonth } }] }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'bookings', where: { status: { equals: 'Pending' } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'bookings', where: { status: { equals: 'Approved' } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'bookings', where: { status: { equals: 'Completed' } }, limit: 0, overrideAccess: true }),
      payload.find({ collection: 'bookings', where: { status: { equals: 'Cancelled' } }, limit: 0, overrideAccess: true }),
    ])

    const completedDocs = await payload.find({ collection: 'bookings', where: { status: { equals: 'Completed' } }, limit: 1000, depth: 0, overrideAccess: true })
    const totalRevenue = (completedDocs.docs  as unknown as Array<Record<string, unknown>>).reduce((s, b) => s + ((b.finalPrice as number | undefined) ?? 0), 0)

    const thisMonthCompletedDocs = await payload.find({ collection: 'bookings', where: { and: [{ status: { equals: 'Completed' } }, { createdAt: { greater_than_equal: startOfMonth } }] }, limit: 1000, depth: 0, overrideAccess: true })
    const thisMonthRevenue = (thisMonthCompletedDocs.docs as unknown as Array<Record<string, unknown>>).reduce((s, b) => s + ((b.finalPrice as number | undefined) ?? 0), 0)

    const customers = await payload.find({ collection: 'users', where: { role: { equals: 'customer' } }, limit: 0, overrideAccess: true })
    const pendingPayments = await payload.find({ collection: 'payments', where: { status: { equals: 'Pending' } }, limit: 0, overrideAccess: true })

    const monthlyData: Array<{ month: string; bookings: number; revenue: number }> = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString()
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString()
      const mb = await payload.find({ collection: 'bookings', where: { and: [{ createdAt: { greater_than_equal: start } }, { createdAt: { less_than_equal: end } }, { status: { equals: 'Completed' } }] }, limit: 1000, depth: 0, overrideAccess: true })
      const rev = (mb.docs  as unknown as Array<Record<string, unknown>>).reduce((s, b) => s + ((b.finalPrice as number | undefined) ?? 0), 0)
      monthlyData.push({ month: d.toLocaleDateString('en-PK', { month: 'short', year: '2-digit' }), bookings: mb.totalDocs, revenue: rev })
    }

    const recent = await payload.find({ collection: 'bookings', limit: 10, depth: 1, sort: '-createdAt', overrideAccess: true })

    return Response.json({
      bookings: { total: allBookings.totalDocs, thisMonth: thisMonthBookings.totalDocs, lastMonth: lastMonthBookings.totalDocs, pending: pending.totalDocs, approved: approved.totalDocs, completed: completed.totalDocs, cancelled: cancelled.totalDocs },
      revenue: { total: totalRevenue, thisMonth: thisMonthRevenue },
      customers: customers.totalDocs,
      pendingPayments: pendingPayments.totalDocs,
      monthlyData,
      recentBookings: (recent.docs as unknown as Array<Record<string, unknown>>).map((b) => ({
        id: b.id, bookingReference: b.bookingReference, status: b.status, finalPrice: b.finalPrice, createdAt: b.createdAt,
        user: typeof b.user === 'object' && b.user ? { fullName: (b.user as Record<string, unknown>).fullName } : null,
        service: typeof b.service === 'object' && b.service ? { serviceName: (b.service as Record<string, unknown>).serviceName } : null,
      })),
    })
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}