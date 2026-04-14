import type { CollectionConfig } from 'payload'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

import { anyone } from '../../access/anyone'
import { adminOnly } from '../../access/adminOnly'

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    useAsTitle: 'serviceName',
    defaultColumns: ['serviceName', 'loyaltyPointsAwarded', 'isActive'],
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: anyone,
    update: adminOnly,
  },
  fields: [
    {
      name: 'serviceName',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'richText',
      editor: lexicalEditor({}),
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Inactive services are hidden in the booking wizard',
      },
    },
    {
      name: 'loyaltyPointsAwarded',
      type: 'number',
      required: true,
      defaultValue: 100,
      admin: {
        description: 'Base points before tier multiplier is applied',
      },
    },
    {
      name: 'steps',
      type: 'array',
      fields: [
        {
          name: 'stepName',
          type: 'select',
          required: true,
          options: [
            { label: 'Exterior', value: 'Exterior' },
            { label: 'Engine', value: 'Engine' },
            { label: 'Interior', value: 'Interior' },
          ],
        },
        {
          name: 'stepDescription',
          type: 'text',
        },
        {
          name: 'stepOrder',
          type: 'number',
          required: true,
        },
      ],
    },
  ],
  timestamps: true,
}
