import React from 'react'
import '@/styles/reset.scss'
import '@/styles/unreset.scss'
import '@/styles/globals.scss'
import '@/styles/markdown.scss'
import '@/styles/highlighting.scss'
import type { Metadata } from 'next'
import NextTopLoader from 'nextjs-toploader'
import ReducedMotionDetector from '@/components/ReducedMotionDetector'
import Header from '@/components/Header'
import PageContainer from '@/components/PageContainer'
import Footer from '@/components/Footer'
import DesktopOnly from '@/components/DesktopOnly'
import BackToTop from '@/components/BackToTop'
import config from 'config'
import { getSiteUrl } from '@/common/url'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { ThemeProvider } from 'next-themes'
import Script from 'next/script'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: config.title,
  description: config.description,
  metadataBase: getSiteUrl(),
  openGraph: {
    title: config.title,
    description: config.description,
    images: '/api/og',
  },
  alternates: {
    types: {
      'application/rss+xml': [{ url: 'feed.xml', title: 'RSS Feed' }],
    },
    canonical: './',
  },
  icons: {
    icon: config.favicon,
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.className} antialiased`} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": config.siteUrl,
              "@type": "WebSite",
              "name": config.title,
              "alternateName": config.alternateTitle,
              "url": config.siteUrl
            })
          }}
        />
        <Script
          defer
          src={process.env.NEXT_PUBLIC_ANALYTICS_SRC}
          data-website-id={process.env.NEXT_PUBLIC_ANALYTICS_ID}
        />
      </head>
      <body>
        <ReducedMotionDetector />
        <NextTopLoader color="#14b8a6" showSpinner={false} />
        <ThemeProvider disableTransitionOnChange>
          <Header />
          <PageContainer>{children}</PageContainer>
          <Footer />
          {config.backToTopButton && (
            <DesktopOnly>
              <BackToTop />
            </DesktopOnly>
          )}
        </ThemeProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}
