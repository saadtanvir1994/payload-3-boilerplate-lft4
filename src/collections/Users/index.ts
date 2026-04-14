import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { anyone } from '../../access/anyone'
import { adminOnly } from '../../access/adminOnly'

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'mobileNumber',
    defaultColumns: ['fullName', 'currentTier', 'role', 'isActive'],
  },
  access: {
    // Payload admin panel login — admins only
    admin: ({ req }) => {
      if (!req.user) return false
      const user = req.user as { role?: string }
      return user.role === 'admin'
    },
    // OTP route creates users without a session
    create: anyone,
    delete: adminOnly,
    // Authenticated users can read (own record filtered at query level)
    read: authenticated,
    update: authenticated,
  },
  auth: {
    // Customers never use email/password directly — token is issued via verify-otp route
    tokenExpiration: 60 * 60 * 24 * 30, // 30 days
  },
  fields: [
    {
      name: 'fullName',
      type: 'text',
      required: true,
    },
    {
      name: 'mobileNumber',
      type: 'text',
      unique: true,
      admin: {
        description: 'Pakistani format without + prefix e.g. 923001234567',
      },
    },
    {
      name: 'whatsappNumber',
      type: 'text',
      admin: {
        description: 'Auto-set to mobileNumber on create if blank',
      },
    },
    {
      name: 'referralCode',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        description: 'Auto-generated REF-XXXXX',
      },
    },
    {
      name: 'referredBy',
      type: 'relationship',
      relationTo: 'users' as const,
      admin: {
        description: 'Set at signup when referral code is used',
      },
    },
    {
      name: 'loyaltyPointsBalance',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
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
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'customer',
      options: [
        { label: 'Customer', value: 'customer' },
        { label: 'Admin', value: 'admin' },
      ],
    },
    // Hidden from admin UI — managed only by OTP routes
    {
      name: 'otp',
      type: 'text',
      admin: {
        hidden: true,
      },
    },
    {
      name: 'otpExpiresAt',
      type: 'date',
      admin: {
        hidden: true,
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation }) => {
        if (operation === 'create') {
          // Auto-generate referralCode if not already set
          if (!data.referralCode) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
            let code = 'REF-'
            for (let i = 0; i < 5; i++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length))
            }
            data.referralCode = code
          }

          // Auto-set whatsappNumber to mobileNumber if blank
          if (!data.whatsappNumber && data.mobileNumber) {
            data.whatsappNumber = data.mobileNumber
          }
        }

        return data
      },
    ],
  },
  timestamps: true,
}
