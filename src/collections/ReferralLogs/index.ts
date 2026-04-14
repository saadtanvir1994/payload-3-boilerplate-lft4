import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'

export const ReferralLogs: CollectionConfig = {
  slug: 'referral-logs',
  admin: {
    defaultColumns: ['referrer', 'referredUser', 'status', 'voucherIssued'],
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    {
      name: 'referrer',
      type: 'relationship',
      relationTo: 'users' as const,
      required: true,
      admin: {
        description: 'The customer who shared their referral code',
      },
    },
    {
      name: 'referredUser',
      type: 'relationship',
      relationTo: 'users' as const,
      required: true,
      admin: {
        description: 'The new customer who signed up using the referral code',
      },
    },
    {
      name: 'referredUserFirstBooking',
      type: 'relationship',
      relationTo: 'bookings' as const,
      admin: {
        description: 'Set when the referral reward is triggered',
      },
    },
    {
      name: 'voucherIssued',
      type: 'relationship',
      relationTo: 'vouchers' as const,
      admin: {
        description: 'The reward voucher created for the referrer',
      },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'Pending',
      options: [
        { label: 'Pending', value: 'Pending' },
        { label: 'Rewarded', value: 'Rewarded' },
      ],
    },
  ],
  timestamps: true,
}
