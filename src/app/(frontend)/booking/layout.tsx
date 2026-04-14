import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Book a Service — Alpha Wheels',
}

export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return children
}