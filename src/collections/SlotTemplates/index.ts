import type { CollectionConfig } from 'payload'

import { adminOnly } from '../../access/adminOnly'
import { generateSlotsFromTemplate } from '../../lib/slot-generator'

export const SlotTemplates: CollectionConfig = {
  slug: 'slot-templates',
  admin: {
    useAsTitle: 'dayOfWeek',
    defaultColumns: [
      'dayOfWeek',
      'startTime',
      'endTime',
      'slotIntervalMinutes',
      'isActive',
      'generateUntilDate',
    ],
  },
  access: {
    create: adminOnly,
    delete: adminOnly,
    read: adminOnly,
    update: adminOnly,
  },
  fields: [
    {
      name: 'dayOfWeek',
      type: 'select',
      required: true,
      options: [
        { label: 'Monday', value: 'Mon' },
        { label: 'Tuesday', value: 'Tue' },
        { label: 'Wednesday', value: 'Wed' },
        { label: 'Thursday', value: 'Thu' },
        { label: 'Friday', value: 'Fri' },
        { label: 'Saturday', value: 'Sat' },
        { label: 'Sunday', value: 'Sun' },
      ],
    },
    {
      name: 'startTime',
      type: 'text',
      required: true,
      admin: {
        description: 'HH:MM format e.g. 09:00',
      },
    },
    {
      name: 'endTime',
      type: 'text',
      required: true,
      admin: {
        description: 'HH:MM format e.g. 18:00',
      },
    },
    {
      name: 'slotIntervalMinutes',
      type: 'number',
      defaultValue: 60,
      admin: {
        description: 'Duration of each generated slot in minutes',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Only active templates trigger slot generation on save',
      },
    },
    {
      name: 'generateUntilDate',
      type: 'date',
      required: true,
      admin: {
        description: 'Slots will be generated from today up to and including this date',
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'yyyy-MM-dd',
        },
      },
    },
  ],
  hooks: {
    afterChange: [
      async ({ doc, req }) => {
        // Only generate slots when the template is active
        if (!doc.isActive) return

        // generateUntilDate comes from Payload as an ISO string or plain date string
        const rawUntil: unknown = doc.generateUntilDate
        const generateUntilDate =
          typeof rawUntil === 'string'
            ? rawUntil.slice(0, 10)
            : rawUntil instanceof Date
              ? rawUntil.toISOString().slice(0, 10)
              : null

        if (!generateUntilDate) {
          req.payload.logger.error(
            '[slot-templates] generateUntilDate is missing — skipping slot generation',
          )
          return
        }

        await generateSlotsFromTemplate(
          {
            dayOfWeek: doc.dayOfWeek as string,
            startTime: doc.startTime as string,
            endTime: doc.endTime as string,
            slotIntervalMinutes:
              typeof doc.slotIntervalMinutes === 'number' ? doc.slotIntervalMinutes : 60,
            generateUntilDate,
          },
          req.payload,
        )
      },
    ],
  },
  timestamps: true,
}
