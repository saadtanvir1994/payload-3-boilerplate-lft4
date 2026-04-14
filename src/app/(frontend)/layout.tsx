import type { Metadata } from 'next'
import { GeistSans } from 'geist/font/sans'
import React from 'react'

import './globals.css'
import { getServerSideURL } from '@/utilities/getURL'

export const metadata: Metadata = {
  metadataBase: new URL(getServerSideURL()),
  title: 'Alpha Wheels',
  description: 'Professional car detailing services in Lahore.',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
  <html className={GeistSans.variable} lang="en" data-theme="light">

      <body>{children}</body>
    </html>
  )
}