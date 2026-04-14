import type { CollectionConfig } from 'payload'

import { authenticated } from '../../access/authenticated'
import { adminOnly } from '../../access/adminOnly'
import { computeDayOfWeek } from '../../lib/slot-generator'

export const Slots: CollectionConfig = {
  slug: 'slots',
  admin: {
    useAsTitle: 'startTime',
    defaultColumns: [
      'date',
      'startTime',
      'endTime',
      'isAvailable',
      'isBlockedByAdmin',
      'currentBookingCount',
    ],
  },
  access: {
    // Admin creates/deletes slots (also auto-created by slot generator via overrideAccess)
    create: adminOnly,
    delete: adminOnly,
    // Authenticated customers read slots to check availability
    read: authenticated,
    update: adminOnly,
  },
  fields: [
    {
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'yyyy-MM-dd',
        },
      },
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
        description: 'HH:MM format. Auto-computed from startTime + duration when using slot templates',
      },
    },
    {
      name: 'dayOfWeek',
      type: 'select',
      admin: {
        readOnly: true,
        description: 'Auto-computed from date on save',
      },
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
      name: 'isAvailable',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Set false automatically when currentBookingCount reaches maxBookings',
      },
    },
    {
      name: 'isBlockedByAdmin',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Manual override — blocks this slot regardless of booking count',
      },
    },
    {
      name: 'maxBookings',
      type: 'number',
      defaultValue: 1,
    },
    {
      name: 'currentBookingCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Managed automatically by the bookings system',
      },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        // Compute dayOfWeek from the date field on every save
        if (data.date) {
          // Payload stores date as ISO string; extract the date portion
          const dateStr =
            typeof data.date === 'string'
              ? data.date.slice(0, 10)
              : new Date(data.date).toISOString().slice(0, 10)

          data.dayOfWeek = computeDayOfWeek(dateStr)
        }

        return data
      },
    ],
  },
  timestamps: true,
}
