import type { GlobalConfig } from 'payload'

import { adminOnly } from '../access/adminOnly'

export const MembershipTiers: GlobalConfig = {
  slug: 'membership-tiers',
  admin: {
    group: 'Settings',
  },
  access: {
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    {
      name: 'tiers',
      type: 'array',
      admin: {
        description: 'Configure the three loyalty tiers. Do not reorder — order must be Beginner → Gold → Platinum.',
      },
      fields: [
        {
          name: 'tierName',
          type: 'select',
          required: true,
          options: [
            { label: 'Beginner', value: 'Beginner' },
            { label: 'Gold', value: 'Gold' },
            { label: 'Platinum', value: 'Platinum' },
          ],
        },
        {
          name: 'unlocksAtServiceCount',
          type: 'number',
          required: true,
          defaultValue: 0,
          admin: {
            description: 'Total completed services required to reach this tier. Use 0 for the default tier.',
          },
        },
        {
          name: 'freeSlotAtCycleCount',
          type: 'number',
          required: true,
          defaultValue: 5,
          admin: {
            description: 'Services completed in current cycle before a free slot is unlocked',
          },
        },
        {
          name: 'pointsMultiplier',
          type: 'number',
          required: true,
          defaultValue: 1,
          admin: {
            description: 'Multiplier applied to base loyaltyPointsAwarded on each booking',
          },
        },
        {
          name: 'badgeColor',
          type: 'text',
          admin: {
            description: 'Hex colour for UI badge e.g. #C0A020',
          },
        },
        {
          name: 'description',
          type: 'text',
          admin: {
            description: 'Shown to customers on their dashboard',
          },
        },
      ],
    },
  ],
}
