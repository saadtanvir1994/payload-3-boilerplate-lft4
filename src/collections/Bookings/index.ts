
import { authenticated } from '../../access/authenticated'
import { adminOnly } from '../../access/adminOnly'
import { sendNotification } from '../../lib/notifications'
import { handleBookingCompleted } from '../../lib/membership'
import { BasePayload, CollectionConfig } from 'payload'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'bookingReference',
    defaultColumns: ['bookingReference', 'user', 'service', 'status', 'slot', 'finalPrice'],
  },
  access: {
    create: authenticated,
    delete: adminOnly,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'bookingReference',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        description: 'Auto-generated BK-XXXXX',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users' as const,
      required: true,
    },
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services' as const,
      required: true,
    },
    {
      name: 'serviceVariant',
      type: 'relationship',
      relationTo: 'service-variants' as const,
      required: true,
    },
    {
      name: 'slot',
      type: 'relationship',
      relationTo: 'slots' as const,
      required: true,
    },
    {
      name: 'carModel',
      type: 'text',
      required: true,
    },
    {
      name: 'carYear',
      type: 'text',
      required: true,
    },
    {
      name: 'carColor',
      type: 'text',
      required: true,
    },
    {
      name: 'location',
      type: 'select',
      required: true,
      options: [
        { label: 'Studio', value: 'Studio' },
        { label: 'Doorstep', value: 'Doorstep' },
      ],
    },
    {
      name: 'doorstepAddress',
      type: 'text',
      admin: {
        condition: (data) => data.location === 'Doorstep',
        description: 'Required when location is Doorstep',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'Pending',
      options: [
        { label: 'Pending', value: 'Pending' },
        { label: 'Approved', value: 'Approved' },
        { label: 'Cancelled', value: 'Cancelled' },
        { label: 'Completed', value: 'Completed' },
      ],
    },
    {
      name: 'cancellationRequestedBy',
      type: 'select',
      options: [
        { label: 'User', value: 'user' },
        { label: 'Admin', value: 'admin' },
      ],
    },
    {
      name: 'cancellationReason',
      type: 'text',
    },
    {
      name: 'voucherApplied',
      type: 'relationship',
      relationTo: 'vouchers' as const,
    },
    {
      name: 'originalPrice',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Base price from service variant before any discount',
      },
    },
    {
      name: 'discountAmount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Amount discounted via voucher',
      },
    },
    {
      name: 'finalPrice',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Computed: originalPrice minus discountAmount',
      },
    },
    {
      name: 'loyaltyPointsEarned',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'payment',
      type: 'relationship',
      relationTo: 'payments' as const,
    },
    {
      name: 'whatsappAlertSent',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          if (!data.bookingReference) {
            let ref = 'BK-'
            for (let i = 0; i < 5; i++) {
              ref += Math.floor(Math.random() * 10).toString()
            }
            data.bookingReference = ref
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const payload = req.payload

        // ── On CREATE ──────────────────────────────────────────────────────────
        if (operation === 'create') {
          // 1. Increment slot booking count and toggle availability
          try {
            const slot = await payload.findByID({
              collection: 'slots',
              id: typeof doc.slot === 'number' ? doc.slot : (doc.slot as { id: number }).id,
              depth: 0,
              overrideAccess: true,
            })

            const newCount = ((slot.currentBookingCount as number) ?? 0) + 1
            const maxBookings = (slot.maxBookings as number) ?? 1

            await payload.update({
              collection: 'slots',
              id: slot.id,
              data: {
                currentBookingCount: newCount,
                isAvailable: newCount < maxBookings,
              },
              overrideAccess: true,
            })
          } catch (err) {
            payload.logger.error(
              `[bookings] Failed to update slot count for booking ${doc.bookingReference}: ${String(err)}`,
            )
          }

          // 2. Build notification context
          const ctx = await resolveBookingContext(doc, payload)

          // 3. Notify admin
          await sendNotification({
            payload,
            type: 'Booking Confirmed',
            recipientType: 'admin',
            context: ctx,
          })

          // 4. Notify customer
          const userId =
            typeof doc.user === 'number' ? doc.user : (doc.user as { id: number }).id
          await sendNotification({
            payload,
            type: 'Booking Confirmed',
            recipientType: 'customer',
            userId,
            context: ctx,
          })

          return
        }

        // ── On UPDATE — status changes ─────────────────────────────────────────
        if (operation === 'update') {
          const prevStatus = previousDoc?.status as string | undefined
          const newStatus = doc.status as string

          if (prevStatus === newStatus) return

          const userId =
            typeof doc.user === 'number' ? doc.user : (doc.user as { id: number }).id
          const ctx = await resolveBookingContext(doc, payload)

          if (newStatus === 'Approved') {
            await sendNotification({
              payload,
              type: 'Booking Confirmed',
              recipientType: 'customer',
              userId,
              context: ctx,
            })
          }

          if (newStatus === 'Cancelled') {
            // Notify customer
            await sendNotification({
              payload,
              type: 'Booking Cancelled',
              recipientType: 'customer',
              userId,
              context: {
                ...ctx,
                cancellationReason: doc.cancellationReason as string | undefined,
              },
            })

            // Restore slot count
            try {
              const slotId =
                typeof doc.slot === 'number' ? doc.slot : (doc.slot as { id: number }).id
              const slot = await payload.findByID({
                collection: 'slots',
                id: slotId,
                depth: 0,
                overrideAccess: true,
              })

              const newCount = Math.max(
                0,
                ((slot.currentBookingCount as number) ?? 0) - 1,
              )
              const maxBookings = (slot.maxBookings as number) ?? 1

              await payload.update({
                collection: 'slots',
                id: slotId,
                data: {
                  currentBookingCount: newCount,
                  isAvailable: newCount < maxBookings,
                },
                overrideAccess: true,
              })
            } catch (err) {
              payload.logger.error(
                `[bookings] Failed to restore slot count on cancellation: ${String(err)}`,
              )
            }
          }

          if (newStatus === 'Completed') {
            await handleBookingCompleted(doc.id as number, payload)
          }
        }
      },
    ],
  },
  timestamps: true,
}

// ─── Context resolver ─────────────────────────────────────────────────────────

/**
 * Resolves a NotificationContext from a booking document.
 * Fetches related records only as needed to keep DB calls minimal.
 */
async function resolveBookingContext(
  doc: Record<string, unknown>,
  payload: BasePayload,
): Promise<{
  bookingReference?: string
  serviceName?: string
  carType?: string
  slotDate?: string
  slotStartTime?: string
  slotEndTime?: string
  location?: string
  finalPrice?: number
  customerName?: string
  customerWhatsapp?: string
}> {
  const ctx: {
    bookingReference?: string
    serviceName?: string
    carType?: string
    slotDate?: string
    slotStartTime?: string
    slotEndTime?: string
    location?: string
    finalPrice?: number
    customerName?: string
    customerWhatsapp?: string
  } = {
    bookingReference: doc.bookingReference as string | undefined,
    location: doc.location as string | undefined,
    finalPrice: doc.finalPrice as number | undefined,
    carType: doc.carType as string | undefined,
  }

  // Resolve service name
  try {
    const serviceId =
      typeof doc.service === 'number'
        ? doc.service
        : (doc.service as { id: number } | null)?.id
    if (serviceId) {
      const service = await payload.findByID({
        collection: 'services',
        id: serviceId,
        depth: 0,
        overrideAccess: true,
      })
      ctx.serviceName = service.serviceName as string | undefined
    }
  } catch {
    // Non-fatal — leave serviceName undefined
  }

  // Resolve slot date and time
  try {
    const slotId =
      typeof doc.slot === 'number'
        ? doc.slot
        : (doc.slot as { id: number } | null)?.id
    if (slotId) {
      const slot = await payload.findByID({
        collection: 'slots',
        id: slotId,
        depth: 0,
        overrideAccess: true,
      })
      // Payload stores date as ISO string; extract date portion
      const rawDate = slot.date as string | null | undefined
      ctx.slotDate = rawDate ? String(rawDate).slice(0, 10) : undefined
      ctx.slotStartTime = slot.startTime as string | undefined
      ctx.slotEndTime = slot.endTime as string | undefined
    }
  } catch {
    // Non-fatal
  }

  // Resolve carType from serviceVariant
  try {
    const variantId =
      typeof doc.serviceVariant === 'number'
        ? doc.serviceVariant
        : (doc.serviceVariant as { id: number } | null)?.id
    if (variantId) {
      const variant = await payload.findByID({
        collection: 'service-variants',
        id: variantId,
        depth: 0,
        overrideAccess: true,
      })
      ctx.carType = variant.carType as string | undefined
    }
  } catch {
    // Non-fatal
  }

  // Resolve customer name and whatsapp
  try {
    const userId =
      typeof doc.user === 'number'
        ? doc.user
        : (doc.user as { id: number } | null)?.id
    if (userId) {
      const user = await payload.findByID({
        collection: 'users',
        id: userId,
        depth: 0,
        overrideAccess: true,
      })
      ctx.customerName = user.fullName as string | undefined
      ctx.customerWhatsapp =
        (user.whatsappNumber as string | undefined) ??
        (user.mobileNumber as string | undefined)
    }
  } catch {
    // Non-fatal
  }

  return ctx
}