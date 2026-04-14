import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'
import { anyone } from '../../access/anyone'
import { authenticated } from '../../access/authenticated'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    useAsTitle: 'reviewToken',
    defaultColumns: ['booking', 'user', 'rating', 'tokenUsed', 'submittedAt'],
  },
  access: {
    // Admin creates review records and generates tokens
    create: adminOnly,
    delete: adminOnly,
    // Token-based submission route uses overrideAccess — public route handled in API
    read: authenticated,
    update: anyone,
  },
  fields: [
    {
      name: 'booking',
      type: 'relationship',
      relationTo: 'bookings' as const,
      required: true,
      unique: true,
      admin: {
        description: 'One review per booking',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users' as const,
      required: true,
    },
    {
      name: 'reviewToken',
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        description: 'Auto-generated e.g. SVC-4829-XK. Generated via /api/reviews/generate-token',
      },
    },
    {
      name: 'tokenExpiresAt',
      type: 'date',
      admin: {
        readOnly: true,
        description: 'Set when the token is generated',
      },
    },
    {
      name: 'tokenUsed',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        readOnly: true,
        description: 'Set true on submission — single-use token',
      },
    },
    {
      name: 'carPhotoByAdmin',
      type: 'upload',
      relationTo: 'media' as const,
      admin: {
        description: 'Admin must upload a car photo before generating the review token',
      },
    },
    {
      name: 'rating',
      type: 'number',
      min: 1,
      max: 5,
    },
    {
      name: 'reviewText',
      type: 'textarea',
    },
    {
      name: 'customerExtraImages',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media' as const,
          required: true,
        },
      ],
    },
    {
      name: 'submittedAt',
      type: 'date',
    },
    {
      name: 'isVerified',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Auto-set true on submission',
      },
    },
  ],
  timestamps: true,
}
