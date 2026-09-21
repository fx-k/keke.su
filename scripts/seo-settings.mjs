import { createHash } from 'node:crypto'

export class SeoError extends Error {
  constructor(message, kind = 'configuration') { super(message); this.name = 'SeoError'; this.kind = kind }
}
export const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function settingsFor(site, env = process.env, offline = false) {
  const input = site.seo?.description || {}
  const defaults = { mode: 'auto', onAIError: 'fallback-extractive', maxLength: 160,
    maxGenerationsPerBuild: 200, timeoutMs: 60000, maxRetries: 2,
    preview: 'read-only', previewMaxGenerations: 2, revisions: {}, prompt: '' }
  for (const field of Object.keys(input)) {
    if (!(field in defaults)) throw new SeoError(`Unknown seo.description option: ${field}`)
  }
  const s = { ...defaults, ...input }
  for (const [name, values] of Object.entries({ mode: ['auto', 'ai', 'extractive'],
    onAIError: ['fail-build', 'fallback-extractive'], preview: ['read-only', 'isolated'] })) {
    if (!values.includes(s[name])) throw new SeoError(`Invalid seo.description.${name}`)
  }
  for (const [name, min, max] of [['maxLength', 20, 160], ['maxGenerationsPerBuild', 1, 500],
    ['timeoutMs', 1000, 120000], ['maxRetries', 0, 3], ['previewMaxGenerations', 1, 10]]) {
    if (!Number.isInteger(s[name]) || s[name] < min || s[name] > max) throw new SeoError(`seo.description.${name} must be ${min}..${max}`)
  }
  if (typeof s.prompt !== 'string' || s.prompt.length > 16000) throw new SeoError('Invalid seo.description.prompt')
  if (!s.revisions || Array.isArray(s.revisions) || typeof s.revisions !== 'object' ||
    Object.values(s.revisions).some(v => !Number.isInteger(v) || v < 1)) throw new SeoError('revisions must map article slugs to positive integers')
  const key = env.OPENAI_API_KEY?.trim()
  const mode = offline ? 'extractive' : s.mode === 'auto' ? (key ? 'ai' : 'extractive') : s.mode
  if (mode === 'ai' && !key) throw new SeoError('OPENAI_API_KEY is required in ai mode')
  const model = env.OPENAI_MODEL?.trim()
  if (mode === 'ai' && !model) throw new SeoError('OPENAI_MODEL is required when AI is enabled')
  let origin
  try { origin = new URL(site.siteUrl).origin } catch { throw new SeoError('siteUrl must be an absolute URL') }
  const productionNamespace = `seo:descriptions:v1:${fingerprint(origin).slice(0, 20)}`
  const isPreview = env.VERCEL_ENV === 'preview'
  const readOnly = isPreview && s.preview === 'read-only'
  const namespace = isPreview && s.preview === 'isolated'
    ? `${productionNamespace}:preview:${fingerprint([env.VERCEL_GIT_COMMIT_REF || 'preview', s.prompt, model]).slice(0, 20)}`
    : productionNamespace
  return { ...s, mode, key, model, namespace, readOnly, isPreview,
    language: site.language || 'zh-CN',
    baseUrl: env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1',
    limit: isPreview ? Math.min(s.maxGenerationsPerBuild, s.previewMaxGenerations) : s.maxGenerationsPerBuild }
}
