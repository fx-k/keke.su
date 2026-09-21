import { randomUUID } from 'node:crypto'
import utils from '../src/common/seo-utils.js'
import { fingerprint, SeoError } from './seo-settings.mjs'

export const recordKey = (post, s) => `${s.namespace}:${fingerprint(post.slug).slice(0, 24)}:${post.hash}:r${s.revisions[post.slug] || 1}`

function decode(value, post) {
  if (value === null) return null
  let record
  try { record = typeof value === 'string' ? JSON.parse(value) : value } catch { throw new SeoError('Invalid saved SEO record; repair required', 'storage') }
  if (record?.version !== 1 || record.slug !== post.slug || record.sourceHash !== post.hash ||
    !utils.validDescription(record.description)) throw new SeoError('Saved SEO record failed validation; repair required', 'storage')
  return record
}

export async function preparePosts(posts, settings, { store, generate, sleep = ms => new Promise(r => setTimeout(r, ms)),
  now = () => Date.now(), log = () => {} } = {}) {
  const s = settings
  const entries = Object.create(null)
  const stats = { articles: posts.length, reused: 0, generated: 0, fallback: 0, failed: 0, deferred: 0 }
  const excerpt = post => ({ sourceHash: post.hash, description: utils.truncate(utils.fallbackDescription(post.title, post.content), s.maxLength), source: 'extractive' })
  if (s.mode === 'extractive') {
    for (const post of posts) entries[post.slug] = excerpt(post)
    stats.fallback = posts.length
    return { entries, stats }
  }
  const keys = posts.map(p => recordKey(p, s))
  const saved = []
  // Scan once; do not query Redis once for metadata and again for BlogPosting.
  for (let i = 0; i < keys.length; i += 100) saved.push(...await store.readMany(keys.slice(i, i + 100)))
  let attempted = 0
  const useRecord = (post, value) => {
    const record = decode(value, post)
    if (!record) return false
    // Editing a style/length setting must not silently regenerate existing text.
    entries[post.slug] = { sourceHash: post.hash, description: record.description, source: 'ai' }
    return true
  }
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i]
    if (useRecord(post, saved[i])) { stats.reused++; continue }
    if (s.readOnly) { entries[post.slug] = excerpt(post); stats.fallback++; stats.deferred++; continue }
    if (attempted >= s.limit) {
      if (!s.isPreview && s.onAIError === 'fail-build') throw new SeoError('AI article limit reached before full coverage', 'ai')
      entries[post.slug] = excerpt(post); stats.fallback++; stats.deferred++; continue
    }
    const key = keys[i], lock = `${key}:lock`, owner = randomUUID()
    const leaseSeconds = Math.ceil(((s.maxRetries + 1) * s.timeoutMs + 30000) / 1000)
    const deadline = now() + leaseSeconds * 1000 + 15000
    let acquired = false
    while (!(acquired = await store.acquire(lock, owner, leaseSeconds))) {
      if (useRecord(post, await store.read(key))) break
      if (now() >= deadline) throw new SeoError('SEO generation lock wait timed out', 'storage')
      await sleep(1000)
    }
    if (!acquired) { stats.reused++; continue }
    try {
      // Another builder may have completed between MGET and acquiring this lock.
      if (useRecord(post, await store.read(key))) { stats.reused++; continue }
      attempted++
      let description
      try { description = await generate(post, s) }
      catch (error) {
        if (error?.kind !== 'ai' || s.onAIError === 'fail-build') throw error
        stats.failed++; stats.fallback++; entries[post.slug] = excerpt(post)
        log(`WARN ${post.slug}: ${error.message}; extractive description used`)
        continue
      }
      if (!utils.validDescription(description) || Array.from(description).length > s.maxLength) throw new SeoError('Generator returned invalid description', 'ai')
      const record = { version: 1, slug: post.slug, sourceHash: post.hash, description,
        model: s.model, promptHash: fingerprint(s.prompt), language: s.language,
        generatedAt: new Date().toISOString() }
      // Compare lock ownership and save-once atomically; use the stored winner.
      const accepted = await store.save(key, lock, owner, record)
      if (accepted === null || accepted === false || !useRecord(post, accepted)) throw new SeoError('SEO record was not persisted; deployment stopped', 'storage')
      stats.generated++
      log(`GENERATED ${post.slug}`)
    } finally { await store.release(lock, owner) }
  }
  return { entries, stats }
}
