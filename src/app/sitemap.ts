import { MetadataRoute } from 'next'
import { getSiteUrl } from '@/common/url'
import { getLatestPosts } from '@/common/post'
import { postDates } from '@/common/seo-utils'

export const revalidate = 60

export default async function sitemap() {
  // Static pages have no reliable content timestamp: omit lastModified.
  const staticMap = ['/', '/posts', '/tags', '/friends'].map(route => ({
    url: getSiteUrl(route).href,
  })) satisfies MetadataRoute.Sitemap

  const posts = await getLatestPosts()
  const dynamicMap = posts.map(post => {
    const { modified } = postDates(post.frontmatter)
    return {
      url: getSiteUrl(`/posts/${post.slug}.html`).href,
      ...(modified ? { lastModified: modified } : {}),
    }
  }) satisfies MetadataRoute.Sitemap

  return [...staticMap, ...dynamicMap]
}
