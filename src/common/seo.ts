import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import config from 'config'
import { entries } from '@/generated/seo-build'
import { fallbackDescription, sourceHash, truncate } from './seo-utils'

// Only compiler output is read here. Redis and AI clients exist in build scripts only.
export async function getPostDescription(slug: string): Promise<string> {
  const raw = await fs.readFile(path.join(process.cwd(), 'posts', `${slug}.mdx`), 'utf8')
  const { data, content } = matter(raw)
  const title = String(data.title || slug)
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : []
  if (process.env.NODE_ENV === 'development' || data.draft) {
    return truncate(fallbackDescription(title, content), config.seo.description.maxLength)
  }
  const record = entries[slug]
  if (!record || record.sourceHash !== sourceHash(title, tags, content)) {
    throw new Error('SEO compiler input missing or stale; run npm run build')
  }
  return record.description
}
