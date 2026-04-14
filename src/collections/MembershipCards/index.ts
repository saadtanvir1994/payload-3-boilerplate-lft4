import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'
import { authenticated } from '../../access/authenticated'

export const MembershipCards: CollectionConfig = {
  slug: 'membership-cards',
  admin: {
    defaultColumns: [
      'user',
      'currentTier',
      'servicesCompletedInCycle',
      'totalServicesEver',
      'freeSlotUnlocked',
    ],
  },
  access: {
    // System creates cards via overrideAccess in handleBookingCompleted
    create: adminOnly,
    delete: adminOnly,
    // Customers can read their own card; admin reads all
    read: authenticated,
    // System updates via overrideAccess; admin can also update manually
    update: authenticated,
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users' as const,
      required: true,
      unique: true,
      admin: {
        description: 'One membership card per customer',
      },
    },
    {
      name: 'currentTier',
      type: 'select',
      defaultValue: 'Beginner',
      options: [
        { label: 'Beginner', value: 'Beginner' },
        { label: 'Gold', value: 'Gold' },
        { label: 'Platinum', value: 'Platinum' },
      ],
    },
    {
      name: 'servicesCompletedInCycle',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Resets to 0 when a free slot is granted',
      },
    },
    {
      name: 'freeSlotUnlocked',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Set true when cycle threshold is reached',
      },
    },
    {
      name: 'freeSlotUsed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Cleared after the free booking is consumed',
      },
    },
    {
      name: 'cycleStartDate',
      type: 'date',
      admin: {
        description: 'Date the current loyalty cycle began',
      },
    },
    {
      name: 'totalServicesEver',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Cumulative all-time completed service count',
      },
    },
  ],
  timestamps: true,
}
