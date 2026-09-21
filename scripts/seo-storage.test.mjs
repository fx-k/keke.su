import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import utils from '../src/common/seo-utils.js'
import { settingsFor, SeoError } from './seo-settings.mjs'
import { preparePosts, recordKey } from './seo-prepare.mjs'
import { createStore, SAVE, RELEASE } from './seo-store.mjs'

const env = { OPENAI_API_KEY: 'test-key', OPENAI_MODEL: 'test-model' }
const site = { siteUrl: 'https://example.com', language: 'zh-CN', seo: { description: {} } }
const settings = extra => settingsFor({ ...site, seo: { description: { ...extra } } }, env)
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

test('auto without a key and explicit extractive never use Redis/AI', async () => {
  for (const s of [settingsFor(site, {}), settings({ mode: 'extractive' })]) {
    const result = await preparePosts([post()], s, { generate: neverGenerate })
    assert.equal(result.stats.fallback, 1)
  }
})
test('ai mode requires a key and model; invalid enums/options fail early', () => {
  assert.throws(() => settingsFor({ ...site, seo: { description: { mode: 'ai' } } }, {}))
  assert.throws(() => settingsFor(site, { OPENAI_API_KEY: 'test' }))
  for (const bad of [{ mode: 'AI' }, { onAIError: 'ignore' }, { preview: 'public' }, { timeoutMs: 0 }, { unknown: 1 }, { revisions: { a: 0 } }]) assert.throws(() => settings(bad))
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
  const s = settingsFor({ ...site, seo: { description: { prompt: '全新的文风', maxLength: 20 } } }, { OPENAI_API_KEY: 'rotated', OPENAI_MODEL: 'another-model' })
  const result = await preparePosts([post()], s, { store, generate: neverGenerate })
  assert.equal(result.entries.a.description, text)
  assert.equal(store.writes, 1)
})
test('explicit per-article revision creates only the selected new version', async () => {
  const store = new MemoryStore()
  await preparePosts([post('a'), post('b')], settings(), { store, generate: async () => text })
  const result = await preparePosts([post('a'), post('b')], settings({ revisions: { a: 2 } }), { store, generate: async () => text })
  assert.equal(result.stats.generated, 1); assert.equal(result.stats.reused, 1)
  assert.equal(store.records.size, 3)
})
test('Redis read failure is fatal, never mistaken for a missing record', async () => {
  await assert.rejects(() => preparePosts([post()], settings(), { store: { readMany: async () => { throw new SeoError('redis down', 'storage') } }, generate: neverGenerate }), /redis down/)
})
test('corrupt stored record is fatal and not regenerated', async () => {
  const store = new MemoryStore(new Map([[recordKey(post(), settings()), '{bad json']]))
  await assert.rejects(() => preparePosts([post()], settings(), { store, generate: neverGenerate }), /Invalid saved/)
})
test('Redis write failure blocks publishing even with AI fallback enabled', async () => {
  const store = new MemoryStore()
  store.save = async () => { throw new SeoError('write failed', 'storage') }
  await assert.rejects(() => preparePosts([post()], settings(), { store, generate: async () => text }), /write failed/)
})
test('a lost lock cannot publish an unpersisted model result', async () => {
  const store = new MemoryStore(); store.save = async () => null
  await assert.rejects(() => preparePosts([post()], settings(), { store, generate: async () => text }), /not persisted/)
})
test('fallback is not stored as AI success and can be retried next build', async () => {
  const store = new MemoryStore()
  const result = await preparePosts([post()], settings(), { store, generate: async () => { throw new SeoError('LLM timeout', 'ai') } })
  assert.equal(result.entries.a.source, 'extractive'); assert.equal(store.records.size, 0)
  const next = await preparePosts([post()], settings(), { store, generate: async () => text })
  assert.equal(next.entries.a.source, 'ai'); assert.equal(store.records.size, 1)
})
test('strict AI policy and authentication errors cannot silently fall back', async () => {
  await assert.rejects(() => preparePosts([post()], settings({ onAIError: 'fail-build' }), { store: new MemoryStore(), generate: async () => { throw new SeoError('LLM failed', 'ai') } }), /LLM failed/)
  await assert.rejects(() => preparePosts([post()], settings(), { store: new MemoryStore(), generate: async () => { throw new SeoError('LLM HTTP 401') } }), /401/)
})
test('read-only previews do not generate, lock or write missing records', async () => {
  const s = settingsFor(site, { ...env, VERCEL_ENV: 'preview' })
  const store = new MemoryStore(); store.acquire = neverGenerate
  const result = await preparePosts([post()], s, { store, generate: neverGenerate })
  assert.equal(result.stats.deferred, 1); assert.equal(store.writes, 0)
})
test('isolated previews have a different namespace and a small generation cap', () => {
  const s = settingsFor({ ...site, seo: { description: { preview: 'isolated' } } }, { ...env, VERCEL_ENV: 'preview', VERCEL_GIT_COMMIT_REF: 'feature/test' })
  assert.notEqual(s.namespace, settings().namespace); assert.equal(s.limit, 2)
})
test('two concurrent builds converge on one persisted result and one AI call', async () => {
  const store = new MemoryStore(); let calls = 0
  const generate = async () => { calls++; await new Promise(r => setTimeout(r, 10)); return text }
  const deps = { store, generate, sleep: () => new Promise(r => setTimeout(r, 1)) }
  const [a, b] = await Promise.all([preparePosts([post()], settings(), deps), preparePosts([post()], settings(), deps)])
  assert.deepEqual(a.entries, b.entries); assert.equal(calls, 1); assert.equal(store.writes, 1)
})
test('article cap is explicit and strict production refuses incomplete coverage', async () => {
  const result = await preparePosts([post('a'), post('b')], settings({ maxGenerationsPerBuild: 1 }), { store: new MemoryStore(), generate: async () => text })
  assert.equal(result.stats.generated, 1); assert.equal(result.stats.deferred, 1)
  await assert.rejects(() => preparePosts([post('a'), post('b')], settings({ maxGenerationsPerBuild: 1, onAIError: 'fail-build' }), { store: new MemoryStore(), generate: async () => text }), /limit reached/)
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
test('compiler output is not an input source and automatic write-back workflow is absent', async () => {
  const code = await fs.readFile('scripts/prepare-seo.mjs', 'utf8')
  assert.doesNotMatch(code, /readFile\(output|\.next\/cache|seo-descriptions\.json/)
  await assert.rejects(() => fs.access('.github/workflows/seo-descriptions.yml'))
  await assert.rejects(() => fs.access('src/generated/seo-descriptions.json'))
})
