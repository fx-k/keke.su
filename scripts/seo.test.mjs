import test from 'node:test'
import assert from 'node:assert/strict'
import utils from '../src/common/seo-utils.js'
import { apiEndpoint, requestDescription } from './seo-api.mjs'
const description = '介绍如何部署远程服务并配置授权，结合示例说明连接流程、权限设置和常见问题。'
const post = { title: '连接教程', tags: ['技术向'], content: '介绍如何部署远程服务并配置授权。' }
const options = { key: 'test-only-not-a-real-key', model: 'test-model', sleep: async () => {} }
const okResponse = () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ description }) } }] }))

test('extractive fallback removes code, HTML and image markup', () => {
  const result = utils.fallbackDescription('教程', '# 前言\n这是说明。 ![image](https://example.com/a.png)\n```js\nsecret()\n```\n<b>正文</b>')
  assert.equal(result, '教程。前言 这是说明。 正文')
})
test('different post titles produce independent fallback descriptions', () => {
  assert.notEqual(utils.fallbackDescription('甲文章', '共同前言'), utils.fallbackDescription('乙文章', '共同前言'))
})
test('fallback truncates safely by Unicode code point', () => {
  assert.equal(Array.from(utils.fallbackDescription('测试', '😎'.repeat(200))).length, 160)
})
test('cache hashes are stable and change with article text or title', () => {
  assert.equal(utils.sourceHash('a', [], 'body'), utils.sourceHash('a', [], 'body'))
  assert.notEqual(utils.sourceHash('a', [], 'body'), utils.sourceHash('a', [], 'updated body'))
  assert.notEqual(utils.sourceHash('a', [], 'body'), utils.sourceHash('b', [], 'body'))
})
test('valid update date is used rather than execution time', () => {
  assert.deepEqual(utils.postDates({ date: '2020-01-01', updatedOn: '2024-02-03' }), {
    published: '2020-01-01T00:00:00.000Z', modified: '2024-02-03T00:00:00.000Z',
  })
})
test('missing or invalid update time falls back to publication', () => {
  assert.equal(utils.postDates({ date: '2020-01-01', updatedOn: 'invalid' }).modified, '2020-01-01T00:00:00.000Z')
})
test('missing dates remain missing, not now', () => {
  assert.deepEqual(utils.postDates({}), { published: undefined, modified: undefined })
})
test('modified time cannot precede publication', () => {
  assert.equal(utils.postDates({ date: '2024-01-01', updatedOn: '2020-01-01' }).modified, '2024-01-01T00:00:00.000Z')
})
test('Date objects from YAML are supported', () => {
  assert.equal(utils.isoDate(new Date('2024-01-01Z')), '2024-01-01T00:00:00.000Z')
})
test('JSON-LD serialization cannot close its script element', () => {
  const value = { title: '</script><script>alert(1)</script>' }
  const encoded = utils.safeJson(value)
  assert.ok(!encoded.includes('<'))
  assert.deepEqual(JSON.parse(encoded), value)
})
test('BlogPosting uses canonical URL and real dates', () => {
  const data = utils.blogPosting({ title: '标题', description, url: 'https://keke.su/posts/test.html', author: 'Mr.Ke', authorUrl: 'https://keke.su/', language: 'zh-CN', date: '2024-01-01', image: '图片外链' })
  assert.equal(data['@context'], 'https://schema.org')
  assert.equal(data['@type'], 'BlogPosting')
  assert.equal(data.mainEntityOfPage['@id'], 'https://keke.su/posts/test.html')
  assert.equal(data.dateModified, '2024-01-01T00:00:00.000Z')
  assert.ok(!('image' in data))
})
test('BlogPosting may reference the existing image without changing OG', () => {
  const data = utils.blogPosting({ title: 'a', description, url: 'https://keke.su/posts/a.html', author: 'a', authorUrl: 'https://keke.su/', language: 'zh-CN', image: '/image.png' })
  assert.deepEqual(data.image, ['https://keke.su/image.png'])
})
test('description output is validated', () => {
  assert.equal(utils.parseDescriptionResponse(JSON.stringify({ description })), description)
  assert.throws(() => utils.parseDescriptionResponse('{"description":"<script>not allowed</script>"}'))
  assert.throws(() => utils.parseDescriptionResponse(JSON.stringify({ description: 'a'.repeat(161) })))
})
test('API endpoint accepts a versioned base or full completion endpoint', () => {
  assert.equal(apiEndpoint('https://api.openai.com/v1/'), 'https://api.openai.com/v1/chat/completions')
  assert.equal(apiEndpoint('https://example.com/openai/v1/chat/completions'), 'https://example.com/openai/v1/chat/completions')
})
test('API URL rejects HTTP, credentials and query strings', () => {
  for (const base of ['http://example.com/v1', 'https://user:pass@example.com/v1', 'https://example.com/v1?key=secret']) assert.throws(() => apiEndpoint(base))
})
test('LLM success uses a bounded request and does not follow redirects', async () => {
  const result = await requestDescription(post, { ...options, fetchImpl: async (url, init) => {
    assert.equal(init.redirect, 'error')
    assert.equal(JSON.parse(init.body).max_completion_tokens, 2048)
    assert.equal(JSON.parse(init.body).model, options.model)
    return okResponse()
  } })
  assert.equal(result, description)
})
test('429 retries are bounded, then recovery succeeds', async () => {
  let calls = 0
  const result = await requestDescription(post, { ...options, fetchImpl: async () => ++calls < 3 ? new Response('', { status: 429 }) : okResponse() })
  assert.equal(calls, 3)
  assert.equal(result, description)
})
test('authentication failure is not retried and does not leak response text', async () => {
  let calls = 0
  await assert.rejects(() => requestDescription(post, { ...options, fetchImpl: async () => { calls++; return new Response('SECRET MUST NOT APPEAR', { status: 401 }) } }), { message: 'LLM HTTP 401' })
  assert.equal(calls, 1)
})
test('malformed model output is not echoed in errors', async () => {
  await assert.rejects(() => requestDescription(post, { ...options, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: 'SECRET MUST NOT APPEAR' } }] })) }), { message: 'Invalid description output' })
})
test('truncated completion is rejected', async () => {
  await assert.rejects(() => requestDescription(post, { ...options, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: JSON.stringify({ description }) } }] })) }), /incomplete/)
})
test('network failure stops after three attempts', async () => {
  let calls = 0
  await assert.rejects(() => requestDescription(post, { ...options, fetchImpl: async () => { calls++; throw new Error('private network details') } }), { message: 'LLM network/timeout error' })
  assert.equal(calls, 3)
})
