import fs from 'fs/promises'
import path from 'path'
import matter from 'gray-matter'
import descriptions from '@/generated/seo-descriptions.json'
import { fallbackDescription, sourceHash, validDescription } from './seo-utils'

interface DescriptionEntry {
  description: string
  sourceHash: string
  model?: string
  generatedAt?: string
}

// Server-side only: never calls an LLM during page requests or normal builds.
export async function getPostDescription(slug: string): Promise<string> {
  const raw = await fs.readFile(path.join(process.cwd(), 'posts', `${slug}.mdx`), 'utf8')
  const { data, content } = matter(raw)
  const title = String(data.title || slug)
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : []
  const cached = (descriptions.posts as Record<string, DescriptionEntry>)[slug]
  if (cached?.sourceHash === sourceHash(title, tags, content) && validDescription(cached.description)) {
    return cached.description
  }
  // New/changed posts work immediately even before the optional AI workflow finishes.
  return fallbackDescription(title, content)
}
