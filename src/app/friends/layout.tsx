import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { navigationTitle } from '@/common/seo-titles'

export const metadata: Metadata = {
  title: navigationTitle('friends'),
}

export default function FriendsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
