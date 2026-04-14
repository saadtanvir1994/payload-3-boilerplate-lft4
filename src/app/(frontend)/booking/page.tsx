import type { Metadata } from 'next'
import { BookingFlow } from './BookingFlow'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Book a Service — Alpha Wheels',
  description: 'Book your car detailing service with Alpha Wheels.',
}

// URL param → DB value maps
const CAR_TYPE_MAP: Record<string, string> = {
  hatchback: 'Hatchback',
  sedan: 'Sedan',
  'luxury-sedan': 'Luxury Sedan',

  // merged category
  crossover: 'Crossover / MPV',
  mpv: 'Crossover / MPV',
  'crossover/mpv': 'Crossover / MPV',

  suv: '7-Seater SUV',
  '7-seater-suv': '7-Seater SUV',

  'luxury-suv': 'Luxury SUV / Exotic',
  luxury: 'Luxury SUV / Exotic',
}
const LOCATION_MAP: Record<string, string> = {
  studio: 'Studio',
  doorstep: 'Doorstep',
  'door-step': 'Doorstep',
}

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>

export default async function BookingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams

  const rawServiceName = typeof params.service_name === 'string' ? params.service_name : ''
  const rawCarType = typeof params.car_type === 'string' ? params.car_type.toLowerCase() : ''
  const rawLocation = typeof params.location === 'string' ? params.location.toLowerCase() : ''

  const prefilledServiceSlug = rawServiceName || null
  const prefilledCarType = CAR_TYPE_MAP[rawCarType] ?? null
  const prefilledLocation = LOCATION_MAP[rawLocation] ?? null

  return (
    <BookingFlow
      prefilledServiceSlug={prefilledServiceSlug}
      prefilledCarType={prefilledCarType}
      prefilledLocation={prefilledLocation}
    />
  )
}