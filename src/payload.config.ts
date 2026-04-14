import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import sharp from 'sharp'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Services } from './collections/Services'
import { ServiceVariants } from './collections/ServiceVariants'
import { Slots } from './collections/Slots'
import { SlotTemplates } from './collections/SlotTemplates'
import { Bookings } from './collections/Bookings'
import { Payments } from './collections/Payments'
import { Notifications } from './collections/Notifications'
import { MembershipCards } from './collections/MembershipCards'
import { LoyaltyTransactions } from './collections/LoyaltyTransactions'
import { Vouchers } from './collections/Vouchers'
import { ReferralLogs } from './collections/ReferralLogs'
import { Reviews } from './collections/Reviews'
import { BookingSettings } from './globals/BookingSettings'
import { MembershipTiers } from './globals/MembershipTiers'
import { plugins } from './plugins'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  collections: [
    Users,
    Media,
    Services,
    ServiceVariants,
    Slots,
    SlotTemplates,
    Bookings,
    Payments,
    Notifications,
    MembershipCards,
    LoyaltyTransactions,
    Vouchers,
    ReferralLogs,
    Reviews,
    // All 14 collections registered — complete
  ],
  globals: [
    BookingSettings,
    MembershipTiers,
  ],
  cors: [process.env.NEXT_PUBLIC_SERVER_URL || ''].filter(Boolean),
  plugins: [...plugins],
  endpoints: [
    {
      path: '/health',
      method: 'get',
      handler: async () => {
        return new Response('OK', { status: 200 })
      },
    },
  ],
  secret: process.env.PAYLOAD_SECRET || '',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
})
