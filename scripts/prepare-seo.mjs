import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import glob from 'fast-glob'
import matter from 'gray-matter'
import utils from '../src/common/seo-utils.js'
import site from '../site.config.js'
import { settingsFor, SeoError } from './seo-settings.mjs'
import { createStore } from './seo-store.mjs'
import { preparePosts } from './seo-prepare.mjs'
import { apiEndpoint, requestDescription } from './seo-api.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
// Disposable compiler input. Always overwritten; NEVER read to restore records.
const output = path.join(root, 'src/generated/seo-build.js')
const args = new Set(process.argv.slice(2))
if ([...args].some(a => !['--offline', '--check'].includes(a))) throw new Error('Supported arguments: --offline, --check')
const offline = args.has('--offline')
const require = createRequire(import.meta.url)
require('@next/env').loadEnvConfig(root, offline, { info() {}, error() {} })

try {
  await fs.mkdir(path.dirname(output), { recursive: true })
  await fs.rm(output, { force: true })
  const settings = settingsFor(site, process.env, offline)
  const files = (await glob('posts/**/*.mdx', { cwd: root, followSymbolicLinks: false })).sort()
  const originals = new Map()
  const posts = []
  for (const file of files) {
    const raw = await fs.readFile(path.join(root, file), 'utf8')
    originals.set(file, raw)
    const { data, content } = matter(raw)
    if (data.draft) continue
    const slug = file.slice(6, -4)
    const title = String(data.title || slug)
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : []
    posts.push({ slug, title, tags, content, hash: utils.sourceHash(title, tags, content), date: utils.isoDate(data.date) || '' })
  }
  posts.sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
  let store
  if (settings.mode === 'ai') {
    apiEndpoint(settings.baseUrl)
    store = createStore()
    console.log(`[seo] AI ${settings.readOnly ? 'read-only preview' : 'build'}; Redis is authoritative`)
    if (!settings.readOnly) console.log('[seo] Required storage policy: Eviction disabled; description records have no TTL. Verify in Upstash Console.')
  } else console.log('[seo] Extractive mode; no AI or Redis calls')
  const usage = { requests: 0, inputTokens: 0, outputTokens: 0 }
  const deps = { store, log: line => console.log(`[seo] ${line}`),
    generate: (post, s) => requestDescription(post, { ...s,
      onRequest: () => usage.requests++,
      onUsage: u => { usage.inputTokens += Number(u.prompt_tokens) || 0; usage.outputTokens += Number(u.completion_tokens) || 0 },
    }) }
  const result = await preparePosts(posts, settings, deps)
  if (args.has('--check') && settings.mode === 'ai' && !settings.readOnly && !result.stats.fallback) {
    const second = await preparePosts(posts, settings, { ...deps,
      generate: async () => { throw new SeoError('Persistence check attempted regeneration', 'storage') } })
    if (JSON.stringify(second.entries) !== JSON.stringify(result.entries)) throw new SeoError('Persistence check changed descriptions', 'storage')
  }
  for (const [file, raw] of originals) {
    if (await fs.readFile(path.join(root, file), 'utf8') !== raw) throw new SeoError('Article files changed during SEO preparation')
  }
  // Export descriptions only. Credentials, endpoint, raw source and provider responses are excluded.
  await fs.writeFile(`${output}.tmp`, `// Generated compiler input. Do not edit.\nexport const entries = ${utils.safeJson(result.entries)};\n`, { mode: 0o600 })
  await fs.rename(`${output}.tmp`, output)
  console.log('[seo] SUMMARY ' + JSON.stringify({ mode: settings.mode, ...result.stats, ...usage }))
  if (result.stats.failed || result.stats.deferred) console.warn('[seo] Some pages use extractive descriptions; they are not saved as AI records.')
} catch (error) {
  await fs.rm(output, { force: true })
  console.error('[seo] ' + (error instanceof SeoError ? error.message : 'Preparation failed; inspect configuration/source locally. No provider response was logged.'))
  process.exitCode = 1
}
