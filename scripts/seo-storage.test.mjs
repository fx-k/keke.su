import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import utils from '../src/common/seo-utils.js'
import siteConfig from '../site.config.js'
import { settingsFor, SeoError, fingerprint } from './seo-settings.mjs'
import { preparePosts, recordKey } from './seo-prepare.mjs'
import { createStore, SAVE, RELEASE } from './seo-store.mjs'
import { requestDescription } from './seo-api.mjs'

const env = { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model' }
const site = { siteUrl: 'https://example.com', language: 'zh-CN', ai_desc_gen: {} }
const settings = extra => settingsFor({ ...site, ai_desc_gen: { ...extra } }, env)
const post = (slug = 'a', content = '原文章讲述接入服务的动机与具体步骤。') => ({ slug, title: '服务接入实践', tags: ['技术'], content,
  hash: utils.sourceHash('服务接入实践', ['技术'], content) })
const text = '原有服务无法执行写入，借助官方接口完成授权与接入，并验证实际调用结果。'
class MemoryStore {
  constructor(records = new Map()) { this.records = records; this.locks = new Map(); this.writes = 0 }
  async readMany(keys) { return keys.map(k => this.records.get(k) ?? null) }
  async read(key) { return this.records.get(key) ?? null }
  async acquire(key, owner) { if (this.locks.has(key)) return false; this.locks.set(key, owner); return true }
  async save(key, lock, owner, record) {
    if (this.records.has(key)) return this.records.get(key)
    if (this.locks.get(lock) !== owner) return null
    this.writes++; this.records.set(key, JSON.stringify(record)); this.locks.delete(lock)
    return this.records.get(key)
  }
  async release(lock, owner) { if (this.locks.get(lock) === owner) this.locks.delete(lock) }
}
const neverGenerate = async () => { throw new Error('Unexpected AI call') }

test('public AI settings are limited to seven documented options with strict defaults', () => {
  assert.deepEqual(Object.keys(siteConfig.ai_desc_gen).sort(), [
    'mode', 'onAIError', 'maxLength', 'maxGenerationsPerBuild', 'timeoutMs', 'maxRetries', 'prompt',
  ].sort())
  assert.equal(siteConfig.seo, undefined)
  assert.equal(siteConfig.ai_desc_gen.onAIError, 'fail-build')
  assert.equal(settings().onAIError, 'fail-build')
  assert.equal(settings().maxLength, 160)
  assert.equal(settingsFor(siteConfig, env).mode, 'ai')
})
test('auto without a key and explicit extractive never use Redis/AI', async () => {
  for (const s of [settingsFor(site, {}), settings({ mode: 'extractive' })]) {
    const result = await preparePosts([post()], s, { generate: neverGenerate })
    assert.equal(result.stats.fallback, 1)
  }
})
test('ai requires key and model; malformed configuration fails before remote calls', () => {
  assert.throws(() => settingsFor({ ...site, ai_desc_gen: { mode: 'ai' } }, {}))
  assert.throws(() => settingsFor(site, { OPENAI_API_KEY: 'test' }))
  for (const bad of [{ mode: 'AI' }, { onAIError: 'fail- build' }, { timeoutMs: 0 }, { unknown: 1 },
    { maxLength: 161 }, { maxRetries: -1 }, { maxGenerationsPerBuild: 0 }]) assert.throws(() => settings(bad))
  for (const bad of [false, [], 'ai']) assert.throws(() => settingsFor({ ...site, ai_desc_gen: bad }, env))
})
test('generation settings do not expose revisions, preview controls or a title separator', () => {
  for (const name of ['revisions', 'preview', 'previewMaxGenerations', 'titleSeparator']) {
    assert.throws(() => settings({ [name]: 1 }), /Unknown ai_desc_gen option/)
  }
})
test('mode comes from site configuration, not a second environment switch', () => {
  assert.equal(settingsFor(site, { ...env, SEO_DESCRIPTION_MODE: 'extractive' }).mode, 'ai')
})
test('cold second build reads original persisted bytes without any local cache', async () => {
  const records = new Map(), firstStore = new MemoryStore(records)
  let calls = 0
  const first = await preparePosts([post()], settings(), { store: firstStore, generate: async () => { calls++; return text } })
  const coldStore = new MemoryStore(records)
  const second = await preparePosts([post()], settings(), { store: coldStore, generate: neverGenerate })
  assert.deepEqual(second.entries, first.entries)
  assert.equal(calls, 1); assert.equal(coldStore.writes, 0); assert.equal(second.stats.reused, 1)
})
test('only changed article content is generated; old versions are retained', async () => {
  const store = new MemoryStore(); let calls = 0
  const generate = async () => { calls++; return text }
  await preparePosts([post('a'), post('b')], settings(), { store, generate })
  const result = await preparePosts([post('a'), post('b', '修改后的文章内容。')], settings(), { store, generate })
  assert.equal(calls, 3); assert.equal(result.stats.reused, 1); assert.equal(store.records.size, 3)
})
test('model, prompt, key and length changes do not rewrite saved descriptions', async () => {
  const store = new MemoryStore()
  await preparePosts([post()], settings(), { store, generate: async () => text })
  const s = settingsFor({ ...site, ai_desc_gen: { prompt: '全新的文风', maxLength: 20 } }, { OPENAI_API_KEY: 'rotated', OPENAI_MODEL: 'another-model' })
  const result = await preparePosts([post()], s, { store, generate: neverGenerate })
  assert.equal(result.entries.a.description, text)
  assert.equal(store.writes, 1)
})
test('stored r1 records retain the exact same identity and are reused without regeneration', async () => {
  const p = post(), s = settings()
  const key = `seo:descriptions:v1:${fingerprint(new URL(site.siteUrl).origin).slice(0, 20)}:${fingerprint(p.slug).slice(0, 24)}:${p.hash}:r1`
  const record = { version: 1, slug: p.slug, sourceHash: p.hash, description: text, model: 'saved-model', generatedAt: '2026-01-01T00:00:00.000Z' }
  const store = new MemoryStore(new Map([[key, JSON.stringify(record)]]))
  assert.equal(recordKey(p, s), key)
  const result = await preparePosts([p], s, { store, generate: neverGenerate })
  assert.equal(result.entries.a.description, text)
  assert.equal(result.stats.reused, 1); assert.equal(store.writes, 0)
})
test('Redis read failure is fatal under either AI policy, never treated as a missing record', async () => {
  for (const onAIError of ['fail-build', 'fallback-extractive']) {
    await assert.rejects(() => preparePosts([post()], settings({ onAIError }), { store: { readMany: async () => { throw new SeoError('redis down', 'storage') } }, generate: neverGenerate }), /redis down/)
  }
})
test('corrupt stored record is fatal and not regenerated', async () => {
  const store = new MemoryStore(new Map([[recordKey(post(), settings()), '{bad json']]))
  await assert.rejects(() => preparePosts([post()], settings(), { store, generate: neverGenerate }), /Invalid saved/)
})
test('Redis write failure blocks publishing even with AI fallback enabled', async () => {
  const store = new MemoryStore()
  store.save = async () => { throw new SeoError('write failed', 'storage') }
  await assert.rejects(() => preparePosts([post()], settings({ onAIError: 'fallback-extractive' }), { store, generate: async () => text }), /write failed/)
})
test('a lost lock cannot publish an unpersisted model result', async () => {
  const store = new MemoryStore(); store.save = async () => null
  await assert.rejects(() => preparePosts([post()], settings(), { store, generate: async () => text }), /not persisted/)
})
test('fallback is not stored as AI success and can be retried next build', async () => {
  const store = new MemoryStore()
  const result = await preparePosts([post()], settings({ onAIError: 'fallback-extractive' }), { store, generate: async () => { throw new SeoError('LLM timeout', 'ai') } })
  assert.equal(result.entries.a.source, 'extractive'); assert.equal(store.records.size, 0)
  const next = await preparePosts([post()], settings(), { store, generate: async () => text })
  assert.equal(next.entries.a.source, 'ai'); assert.equal(store.records.size, 1)
})
test('auto with a key fails the build on AI errors by default', async () => {
  const store = new MemoryStore()
  assert.equal(settings().mode, 'ai')
  await assert.rejects(() => preparePosts([post()], settings(), { store,
    generate: async () => { throw new SeoError('LLM timeout', 'ai') } }), /LLM timeout/)
  assert.equal(store.records.size, 0); assert.equal(store.locks.size, 0)
})
for (const mode of ['auto', 'ai']) {
  for (const onAIError of ['fail-build', 'fallback-extractive']) {
    test(`${mode} routes upstream HTTP errors through ${onAIError}`, async () => {
      for (const status of [400, 401, 403, 404, 429, 500]) {
        let calls = 0
        const store = new MemoryStore(), logs = []
        const s = settings({ mode, onAIError, maxRetries: 0 })
        const work = () => preparePosts([post()], s, { store, log: line => logs.push(line),
          generate: (p, opts) => requestDescription(p, { ...opts,
            fetchImpl: async () => { calls++; return new Response('PRIVATE PROVIDER RESPONSE', { status }) },
          }) })
        if (onAIError === 'fail-build') {
          await assert.rejects(work, error => error.kind === 'ai' && error.message === `LLM HTTP ${status}`)
        } else {
          const result = await work()
          assert.equal(result.stats.failed, 1); assert.equal(result.entries.a.source, 'extractive')
          assert.ok(logs.some(line => line.includes(String(status))))
        }
        assert.equal(calls, 1); assert.equal(store.records.size, 0); assert.equal(store.locks.size, 0)
        assert.ok(logs.every(line => !line.includes('PRIVATE PROVIDER RESPONSE')))
      }
    })
  }
}
test('invalid generator output follows the selected policy before any persistence', async () => {
  for (const invalid of ['short', 'x'.repeat(161)]) {
    const store = new MemoryStore()
    const result = await preparePosts([post()], settings({ onAIError: 'fallback-extractive' }), { store, generate: async () => invalid })
    assert.equal(result.entries.a.source, 'extractive'); assert.equal(store.writes, 0)
    await assert.rejects(() => preparePosts([post()], settings(), { store, generate: async () => invalid }), /invalid description/)
  }
})
test('non-AI configuration failures are not hidden by the model failure policy', async () => {
  await assert.rejects(() => preparePosts([post()], settings({ onAIError: 'fallback-extractive' }), {
    store: new MemoryStore(), generate: async () => { throw new SeoError('Invalid OPENAI_BASE_URL') },
  }), error => error.kind === 'configuration')
})
test('read-only preview protection is intrinsic and missing records never cause paid calls or writes', async () => {
  const s = settingsFor(site, { ...env, VERCEL_ENV: 'preview' })
  assert.equal(s.readOnly, true)
  assert.equal(settings().readOnly, false)
  assert.equal(s.namespace, settings().namespace)
  const store = new MemoryStore(); store.acquire = neverGenerate
  const result = await preparePosts([post()], s, { store, generate: neverGenerate })
  assert.equal(result.stats.deferred, 1); assert.equal(store.writes, 0)
})
test('previews read saved text without generating or changing it', async () => {
  const store = new MemoryStore()
  await preparePosts([post()], settings(), { store, generate: async () => text })
  const result = await preparePosts([post()], settingsFor(site, { ...env, VERCEL_ENV: 'preview' }), { store, generate: neverGenerate })
  assert.equal(result.entries.a.description, text)
  assert.equal(result.stats.reused, 1); assert.equal(store.writes, 1)
})
test('two concurrent builds converge on one persisted result and one AI call', async () => {
  const store = new MemoryStore(); let calls = 0
  const generate = async () => { calls++; await new Promise(r => setTimeout(r, 10)); return text }
  const deps = { store, generate, sleep: () => new Promise(r => setTimeout(r, 1)) }
  const [a, b] = await Promise.all([preparePosts([post()], settings(), deps), preparePosts([post()], settings(), deps)])
  assert.deepEqual(a.entries, b.entries); assert.equal(calls, 1); assert.equal(store.writes, 1)
})
test('article cap follows failure policy and is strict by default', async () => {
  const result = await preparePosts([post('a'), post('b')], settings({ maxGenerationsPerBuild: 1, onAIError: 'fallback-extractive' }), { store: new MemoryStore(), generate: async () => text })
  assert.equal(result.stats.generated, 1); assert.equal(result.stats.deferred, 1)
  await assert.rejects(() => preparePosts([post('a'), post('b')], settings({ maxGenerationsPerBuild: 1 }), { store: new MemoryStore(), generate: async () => text }), /limit reached/)
})
test('Redis REST adapter distinguishes null, HTTP and command failures', async () => {
  const e = { UPSTASH_REDIS_REST_URL: 'https://test.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'fake' }
  const store = createStore(e, async (url, init) => {
    assert.equal(init.redirect, 'error')
    assert.deepEqual(JSON.parse(init.body), ['MGET', 'a'])
    return new Response(JSON.stringify({ result: [null] }))
  })
  assert.deepEqual(await store.readMany(['a']), [null])
  for (const response of [new Response('secret', { status: 401 }), new Response(JSON.stringify({ error: 'secret' }))]) {
    await assert.rejects(() => createStore(e, async () => response).read('a'), error => !error.message.includes('secret') && error.kind === 'storage')
  }
})
test('atomic persistence has no record expiry; lock release checks ownership', () => {
  assert.match(SAVE, /redis.call\('SET', KEYS\[1\], ARGV\[2\], 'NX'\)/)
  assert.doesNotMatch(SAVE, /EXPIRE|SETEX/)
  assert.match(RELEASE, /== ARGV\[1\]/)
})
test('page description reader imports no remote client or credential', async () => {
  const code = await fs.readFile('src/common/seo.ts', 'utf8')
  assert.doesNotMatch(code, /from .*upstash|from .*seo-store|from .*seo-api|OPENAI_|UPSTASH_/)
  assert.match(code, /from '@\/generated\/seo-build'/)
})
test('runtime and generator read the same public AI configuration', async () => {
  const reader = await fs.readFile('src/common/seo.ts', 'utf8')
  const resolver = await fs.readFile('scripts/seo-settings.mjs', 'utf8')
  assert.match(reader, /config\.ai_desc_gen/); assert.match(resolver, /site\.ai_desc_gen/)
  for (const code of [reader, resolver]) assert.doesNotMatch(code, /\.seo\??\.description/)
})
test('compiler output is not an input source and automatic write-back workflow is absent', async () => {
  const code = await fs.readFile('scripts/prepare-seo.mjs', 'utf8')
  assert.doesNotMatch(code, /readFile\(output|\.next\/cache|seo-descriptions\.json/)
  await assert.rejects(() => fs.access('.github/workflows/seo-descriptions.yml'))
  await assert.rejects(() => fs.access('src/generated/seo-descriptions.json'))
})
