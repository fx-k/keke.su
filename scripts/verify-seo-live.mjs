// Preview-only integration verification. Never edits articles or production Redis records.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import glob from 'fast-glob'
import matter from 'gray-matter'
import site from '../site.config.js'
import utils from '../src/common/seo-utils.js'
import { settingsFor, fingerprint, SeoError } from './seo-settings.mjs'
import { createStore } from './seo-store.mjs'
import { preparePosts, recordKey } from './seo-prepare.mjs'
import { requestDescription } from './seo-api.mjs'

const output = 'src/generated/seo-build.js'
const reportPath = 'public/__seo-verification.json'
const reuseOnly = process.argv[2] === '--reuse'
try {
  assert.ok(['--seed', '--reuse'].includes(process.argv[2]), 'Expected --seed or --reuse')
  const require = createRequire(import.meta.url)
  require('@next/env').loadEnvConfig(process.cwd(), false, { info() {}, error() {} })
  assert.equal(process.env.VERCEL_ENV, 'preview', 'Live test requires Preview environment')
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, 'seo/metadata-ai-20260921', 'Unexpected test branch')
  await fs.rm(output, { force: true })
  await fs.rm(reportPath, { force: true })
  const testSite = { ...site, seo: { ...site.seo, description: { ...site.seo.description,
    mode: 'ai', preview: 'isolated', previewMaxGenerations: 2, maxGenerationsPerBuild: 2,
    onAIError: 'fail-build', maxRetries: 0 } } }
  const settings = settingsFor(testSite)
  assert.equal(settings.model, 'gpt-5.6-luna', 'Unexpected test model')
  assert.ok(settings.isPreview && !settings.readOnly && settings.namespace.includes(':preview:'), 'Isolation required')
  settings.namespace += ':live-verification-20260921'
  const store = createStore()
  const originals = new Map(), posts = []
  for (const file of (await glob('posts/**/*.mdx', { followSymbolicLinks: false })).sort()) {
    const raw = await fs.readFile(file, 'utf8')
    originals.set(file, raw)
    const { data, content } = matter(raw)
    if (data.draft) continue
    const slug = file.slice(6, -4), title = String(data.title || slug)
    const tags = Array.isArray(data.tags) ? data.tags.map(String) : []
    posts.push({ slug, title, tags, content, hash: utils.sourceHash(title, tags, content) })
  }
  const slugs = ['2026-09-20-new-1', '2026-09-15-new-1']
  const samples = slugs.map(slug => posts.find(post => post.slug === slug))
  assert.ok(samples.every(Boolean), 'Published fixtures missing')
  const usage = { requests: 0, inputTokens: 0, outputTokens: 0 }
  const result = await preparePosts(samples, settings, { store,
    generate: reuseOnly ? async () => { throw new SeoError('Reuse build attempted an AI request', 'storage') }
      : (post, s) => requestDescription(post, { ...s, onRequest: () => usage.requests++,
          onUsage: u => { usage.inputTokens += Number(u.prompt_tokens) || 0; usage.outputTokens += Number(u.completion_tokens) || 0 } }) })
  assert.equal(result.stats.generated + result.stats.reused, 2, 'Incomplete AI coverage')
  assert.equal(result.stats.fallback, 0, 'No fallback allowed in this test')
  assert.ok(usage.requests <= 2, 'Request cap exceeded')
  if (reuseOnly) { assert.equal(usage.requests, 0); assert.equal(result.stats.generated, 0) }
  async function command(args) {
    const response = await fetch(process.env.UPSTASH_REDIS_REST_URL, { method: 'POST', redirect: 'error',
      signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) })
    assert.equal(response.status, 200, 'Redis verification request failed')
    const data = await response.json()
    assert.ok(!data.error && Object.hasOwn(data, 'result'), 'Redis verification command failed')
    return data.result
  }
  const records = []
  for (const post of samples) {
    const key = recordKey(post, settings), raw = await store.read(key)
    assert.ok(raw !== null, 'Saved record missing')
    const record = typeof raw === 'string' ? JSON.parse(raw) : raw
    assert.equal(record.description, result.entries[post.slug].description, 'Persisted text differs from compiler input')
    const ttl = await command(['TTL', key])
    assert.equal(ttl, -1, 'Description must have no expiration')
    records.push({ slug: post.slug, description: record.description, recordDigest: fingerprint(raw), ttl })
  }
  const digest = fingerprint(records)
  const manifestKey = settings.namespace + ':verified-record-digest'
  if (!reuseOnly) await command(['SET', manifestKey, digest, 'NX'])
  assert.equal(await store.read(manifestKey), digest, 'Descriptions changed since seed build')
  const second = await preparePosts(samples, settings, { store,
    generate: async () => { throw new SeoError('Read-back attempted AI regeneration', 'storage') } })
  assert.deepEqual(second.entries, result.entries)
  const entries = Object.fromEntries(posts.map(post => [post.slug, {
    sourceHash: post.hash, description: utils.truncate(utils.fallbackDescription(post.title, post.content), settings.maxLength), source: 'extractive' }]))
  Object.assign(entries, result.entries)
  for (const [file, raw] of originals) assert.equal(await fs.readFile(file, 'utf8'), raw, 'Article changed')
  await fs.mkdir('src/generated', { recursive: true })
  await fs.mkdir('public', { recursive: true })
  await fs.writeFile(output, `// Generated compiler input.\nexport const entries = ${utils.safeJson(entries)};\n`)
  const report = { status: 'passed', phase: reuseOnly ? 'reuse' : 'seed', commit: process.env.VERCEL_GIT_COMMIT_SHA,
    productionWrites: 0, stats: result.stats, usage, records, digest }
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n')
  console.log('[seo-verification] ' + JSON.stringify(report))
} catch (error) {
  await fs.rm(output, { force: true })
  await fs.rm(reportPath, { force: true })
  console.error('[seo-verification] FAILED: ' + (error instanceof SeoError ? error.message : error?.code === 'ERR_ASSERTION' ? String(error.message).split('\n')[0] : 'Validation error; provider details suppressed'))
  process.exitCode = 1
}
