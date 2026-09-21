import { createHash } from 'node:crypto'

export class SeoError extends Error {
  constructor(message, kind = 'configuration') { super(message); this.name = 'SeoError'; this.kind = kind }
}
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function settingsFor(site, env = process.env, offline = false) {
  const input = site.ai_desc_gen ?? {}
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new SeoError('ai_desc_gen must be an object')
  const defaults = { mode: 'auto', onAIError: 'fail-build', maxLength: 160,
    maxGenerationsPerBuild: 200, timeoutMs: 60000, maxRetries: 2, prompt: '' }
  for (const field of Object.keys(input)) {
    if (!Object.hasOwn(defaults, field)) throw new SeoError(`Unknown ai_desc_gen option: ${field}`)
  }
  const s = { ...defaults, ...input }
  for (const [name, values] of Object.entries({ mode: ['auto', 'ai', 'extractive'],
    onAIError: ['fail-build', 'fallback-extractive'] })) {
    if (!values.includes(s[name])) throw new SeoError(`Invalid ai_desc_gen.${name}`)
  }
  for (const [name, min, max] of [['maxLength', 20, 160], ['maxGenerationsPerBuild', 1, 500],
    ['timeoutMs', 1000, 120000], ['maxRetries', 0, 3]]) {
    if (!Number.isInteger(s[name]) || s[name] < min || s[name] > max) throw new SeoError(`ai_desc_gen.${name} must be ${min}..${max}`)
  }
  if (typeof s.prompt !== 'string' || s.prompt.length > 16000) throw new SeoError('Invalid ai_desc_gen.prompt')
  const key = env.OPENAI_API_KEY?.trim()
  const mode = offline ? 'extractive' : s.mode === 'auto' ? (key ? 'ai' : 'extractive') : s.mode
  if (mode === 'ai' && !key) throw new SeoError('OPENAI_API_KEY is required in ai mode')
  const model = env.OPENAI_MODEL?.trim()
  if (mode === 'ai' && !model) throw new SeoError('OPENAI_MODEL is required when AI is enabled')
  let origin
  try { origin = new URL(site.siteUrl).origin } catch { throw new SeoError('siteUrl must be an absolute URL') }
  const namespace = `seo:descriptions:v1:${fingerprint(origin).slice(0, 20)}`
  // Preview builds may read published records, but cannot spend AI quota or write them.
  const readOnly = env.VERCEL_ENV === 'preview'
  return { ...s, mode, key, model, namespace, readOnly,
    language: site.language || 'zh-CN',
    baseUrl: env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    limit: s.maxGenerationsPerBuild }
}
