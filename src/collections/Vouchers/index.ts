import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'
import { authenticated } from '../../access/authenticated'
import { sendNotification } from '../../lib/notifications'

export const Vouchers: CollectionConfig = {
  slug: 'vouchers',
  admin: {
    useAsTitle: 'code',
    defaultColumns: ['code', 'assignedToUser', 'discountPercent', 'validUntil', 'isUsed', 'source'],
  },
  access: {
    // System creates via overrideAccess; admin can also create manually
    create: adminOnly,
    delete: adminOnly,
    // Customers read their own vouchers; admin reads all
    read: authenticated,
    update: authenticated,
  },
  fields: [
    {
      name: 'code',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        description: 'Auto-generated VC-XXXXXXXX',
      },
    },
    {
      name: 'assignedToUser',
      type: 'relationship',
      relationTo: 'users' as const,
      required: true,
    },
    {
      name: 'discountPercent',
      type: 'number',
      defaultValue: 10,
      admin: {
        description: 'Discount percentage applied at checkout',
      },
    },
    {
      name: 'validUntil',
      type: 'date',
      required: true,
    },
    {
      name: 'isUsed',
      type: 'checkbox',
      defaultValue: false,
    },
    {
      name: 'usedAt',
      type: 'date',
      admin: {
        description: 'Timestamp of redemption',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'Referral',
      options: [
        { label: 'Referral', value: 'Referral' },
      ],
    },
    {
      name: 'referralBooking',
      type: 'relationship',
      relationTo: 'bookings' as const,
      admin: {
        description: 'The booking that triggered this referral reward',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          if (!data.code) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            let code = 'VC-'
            for (let i = 0; i < 8; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length))
            }
            data.code = code
          }
        }
        return data
      },
    ],
    afterChange: [
      async ({ doc, operation, req }) => {
        // On create — send Referral Reward WhatsApp to the assigned user
        if (operation !== 'create') return

        const userId =
          typeof doc.assignedToUser === 'number'
            ? doc.assignedToUser
            : (doc.assignedToUser as { id: number } | null)?.id

        if (!userId) return

        await sendNotification({
          payload: req.payload,
          type: 'Referral Reward',
          recipientType: 'customer',
          userId,
          context: {
            voucherCode: doc.code as string,
          },
        })
      },
    ],
  },
  timestamps: true,
}
