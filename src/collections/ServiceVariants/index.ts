import type { CollectionConfig } from 'payload'

import { anyone } from '../../access/anyone'
import { adminOnly } from '../../access/adminOnly'

export const ServiceVariants: CollectionConfig = {
  slug: 'service-variants',
  admin: {
    // No single natural title field — show composite in columns instead
    defaultColumns: ['service', 'carType', 'location', 'price', 'durationMinutes'],
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: anyone,
    update: adminOnly,
  },
  fields: [
    {
      name: 'service',
      type: 'relationship',
      relationTo: 'services' as const,
      required: true,
    },
    {
      name: 'carType',
      type: 'select',
      required: true,
   options: [
  { label: 'Hatchback', value: 'Hatchback' },
  { label: 'Sedan', value: 'Sedan' },
  { label: 'Luxury Sedan', value: 'Luxury Sedan' },
  { label: 'Crossover / MPV', value: 'Crossover / MPV' },
  { label: '7-Seater SUV', value: '7-Seater SUV' },
  { label: 'Luxury SUV / Exotic', value: 'Luxury SUV / Exotic' },
],
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
      name: 'price',
      type: 'number',
      required: true,
      admin: {
        description: 'Price in PKR',
      },
    },
    {
      name: 'durationMinutes',
      type: 'number',
      required: true,
      defaultValue: 60,
    },
  ],
  timestamps: true,
}
