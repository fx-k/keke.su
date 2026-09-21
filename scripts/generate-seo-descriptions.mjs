import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import glob from 'fast-glob'
import matter from 'gray-matter'
import utils from '../src/common/seo-utils.js'
import { apiEndpoint, requestDescription } from './seo-api.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cachePath = path.join(root, 'src/generated/seo-descriptions.json')
const dryRun = process.argv.includes('--dry-run')
const maxPosts = Number(process.env.SEO_MAX_POSTS || 200)
if (!Number.isInteger(maxPosts) || maxPosts < 1 || maxPosts > 500) throw new Error('SEO_MAX_POSTS must be 1..500')
const model = process.env.OPENAI_MODEL || 'gpt-5.4-mini'
const key = process.env.OPENAI_API_KEY
const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
const cache = JSON.parse(await fs.readFile(cachePath, 'utf8'))
if (cache.version !== 1 || !cache.posts || typeof cache.posts !== 'object' || Array.isArray(cache.posts)) throw new Error('Invalid SEO cache')
const files = (await glob('posts/**/*.mdx', { cwd: root })).sort()
const posts = []
for (const file of files) {
  const raw = await fs.readFile(path.join(root, file), 'utf8')
  const { data, content } = matter(raw)
  if (data.draft) continue // Never send drafts to the LLM.
  const slug = file.replace(/^posts\//, '').replace(/\.mdx$/, '')
  const title = String(data.title || slug)
  const tags = Array.isArray(data.tags) ? data.tags.map(String) : []
  posts.push({ slug, title, tags, content, hash: utils.sourceHash(title, tags, content), date: utils.isoDate(data.date) || '' })
}
// Newest posts first; a backfill resumes from existing successful hashes.
posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
const pending = posts.filter(p => cache.posts[p.slug]?.sourceHash !== p.hash || !utils.validDescription(cache.posts[p.slug]?.description))
if (posts.some(p => !utils.fallbackDescription(p.title, p.content))) throw new Error('Empty fallback description')
console.log(`Published: ${posts.length}; AI cached: ${posts.length - pending.length}; pending: ${pending.length}; fallback coverage: ${posts.length}/${posts.length}`)
if (dryRun || !key) {
  console.log(dryRun ? 'Dry run: no API calls, no file writes.' : 'OPENAI_API_KEY not configured: no API calls; pages use per-post extractive descriptions.')
  process.exit(0)
}
apiEndpoint(baseUrl) // Validate before any API call.
let succeeded = 0
let failed = 0
async function checkpoint() {
  const ordered = { version: 1, posts: Object.fromEntries(Object.entries(cache.posts).sort(([a], [b]) => a.localeCompare(b))) }
  await fs.writeFile(`${cachePath}.tmp`, JSON.stringify(ordered, null, 2) + '\n', { mode: 0o600 })
  await fs.rename(`${cachePath}.tmp`, cachePath)
}
const publishedSlugs = new Set(posts.map(p => p.slug))
let pruned = 0
for (const slug of Object.keys(cache.posts)) {
  if (!publishedSlugs.has(slug)) { delete cache.posts[slug]; pruned++ }
}
for (const post of pending.slice(0, maxPosts)) {
  try {
    const description = await requestDescription(post, { key, model, baseUrl })
    cache.posts[post.slug] = { description, sourceHash: post.hash, model, generatedAt: new Date().toISOString() }
    await checkpoint() // Preserve successes if a later request fails.
    succeeded++
    console.log(`OK ${post.slug}`)
  } catch (error) {
    failed++
    // Errors from the HTTP wrapper are deliberately sanitized; no response body is printed.
    console.error(`FAILED ${post.slug}: ${error.message}`)
    if (/HTTP (400|401|403|404)|network\/timeout/.test(error.message) || failed >= 3) break
  }
}
if (pruned) await checkpoint()
console.log(`Generated: ${succeeded}; failed: ${failed}; remaining: ${pending.length - succeeded}; removed draft/deleted entries: ${pruned}`)
if (failed) process.exitCode = 1
if (pending.length - succeeded > 0) console.log('Rerun the workflow to retry/backfill the remaining posts. Existing matching hashes will not be billed again.')
