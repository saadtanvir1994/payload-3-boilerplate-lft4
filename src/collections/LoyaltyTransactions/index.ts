import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'
import { authenticated } from '../../access/authenticated'

export const LoyaltyTransactions: CollectionConfig = {
  slug: 'loyalty-transactions',
  admin: {
    defaultColumns: [
      'user',
      'booking',
      'pointsEarned',
      'tierMultiplierApplied',
      'transactionDate',
    ],
  },
  access: {
    // System creates records via overrideAccess
    create: adminOnly,
    delete: adminOnly,
    // Customers can read their own history; admin reads all
    read: authenticated,
    // Immutable — no updates
    update: () => false,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users' as const,
      required: true,
    },
    {
      name: 'booking',
      type: 'relationship',
      relationTo: 'bookings' as const,
      required: true,
    },
    {
      name: 'pointsEarned',
      type: 'number',
      required: true,
      admin: {
        description: 'Final points after multiplier applied',
      },
    },
    {
      name: 'tierMultiplierApplied',
      type: 'number',
      required: true,
      defaultValue: 1,
    },
    {
      name: 'transactionDate',
      type: 'date',
      required: true,
    },
    {
      name: 'note',
      type: 'text',
      admin: {
        description: 'Optional admin note',
      },
    },
  ],
  timestamps: true,
}
