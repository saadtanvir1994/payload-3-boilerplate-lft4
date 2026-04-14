import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { adminOnly } from '../../access/adminOnly'
import { sendNotification } from '../../lib/notifications'

export const Payments: CollectionConfig = {
  slug: 'payments',
  admin: {
    defaultColumns: ['booking', 'method', 'amount', 'status', 'confirmedAt'],
  },
  access: {
    create: authenticated,
    delete: adminOnly,
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'booking',
      type: 'relationship',
      relationTo: 'bookings' as const,
      required: true,
    },
    {
      name: 'method',
      type: 'select',
      required: true,
      options: [
        { label: 'Bank Transfer', value: 'Bank Transfer' },
        { label: 'Online', value: 'Online' },
      ],
    },
    {
      name: 'amount',
      type: 'number',
      required: true,
      admin: {
        description: 'Amount in PKR',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'Pending',
      options: [
        { label: 'Pending', value: 'Pending' },
        { label: 'Confirmed', value: 'Confirmed' },
        { label: 'Failed', value: 'Failed' },
      ],
    },
    {
      name: 'bankTransferReferenceNumber',
      type: 'text',
      admin: {
        condition: (data) => data.method === 'Bank Transfer',
        description: 'Entered by the customer',
      },
    },
    {
      name: 'bankTransferReceiptImage',
      type: 'upload',
      relationTo: 'media' as const,
      admin: {
        condition: (data) => data.method === 'Bank Transfer',
        description: 'Customer uploads payment receipt',
      },
    },
    {
      name: 'confirmedByAdmin',
      type: 'relationship',
      relationTo: 'users' as const,
      admin: {
        description: 'Admin user who confirmed the payment',
      },
    },
    {
      name: 'confirmedAt',
      type: 'date',
    },
    {
      name: 'gatewayReference',
      type: 'text',
      admin: {
        description: 'Future: online payment gateway reference',
      },
    },
    {
      name: 'gatewayResponse',
      type: 'json',
      admin: {
        description: 'Future: raw gateway response payload',
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req }) => {
        const payload = req.payload

        const prevStatus = operation === 'create' ? null : (previousDoc?.status as string | null)
        const newStatus = doc.status as string

        // Only act when status transitions to Confirmed
        if (newStatus !== 'Confirmed' || prevStatus === 'Confirmed') return

        // Resolve linked booking
        const bookingId =
          typeof doc.booking === 'number'
            ? doc.booking
            : (doc.booking as { id: number } | null)?.id

        if (!bookingId) {
          payload.logger.error('[payments] No linked booking id on payment doc')
          return
        }

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
            `[payments] Failed to fetch booking ${bookingId}: ${String(err)}`,
          )
          return
        }

        // Resolve customer for notification
        const userId =
          typeof booking.user === 'number'
            ? booking.user
            : (booking.user as { id: number } | null)?.id

        // Build notification context
        const ctx = {
          bookingReference: booking.bookingReference as string | undefined,
          finalPrice: doc.amount as number | undefined,
        }

        // Send Payment Confirmed WhatsApp to customer
        if (userId) {
          await sendNotification({
            payload,
            type: 'Payment Confirmed',
            recipientType: 'customer',
            userId,
            context: ctx,
          })
        }

        // Auto-approve booking based on booking-settings global
        try {
          // Fetch booking-settings global — will be registered in Module 6
          // Using a try/catch so this fails gracefully before globals are added
          const settings = await payload.findGlobal({
            slug: 'booking-settings',
            overrideAccess: true,
          }) as unknown as Record<string, unknown>

          const method = doc.method as string
          const autoApprove =
            (method === 'Bank Transfer' && settings.autoApproveBankTransfer === true) ||
            (method === 'Online' && settings.autoApproveOnlinePayment === true)

          if (autoApprove) {
            const currentStatus = booking.status as string
            if (currentStatus !== 'Approved' && currentStatus !== 'Completed') {
              await payload.update({
                collection: 'bookings',
                id: bookingId,
                data: { status: 'Approved' },
                overrideAccess: true,
              })
            }
          }
        } catch (err) {
          // booking-settings global not yet registered — skip auto-approve silently
          payload.logger.warn(
            `[payments] Could not read booking-settings for auto-approve: ${String(err)}`,
          )
        }
      },
    ],
  },
  timestamps: true,
}
