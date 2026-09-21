import type { Metadata } from 'next'
import type { ReactNode } from 'react'

// Metadata stays in a server layout; the existing client page and its UI are untouched.
export const metadata: Metadata = {
  title: '友情链接',
}

export default function FriendsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
