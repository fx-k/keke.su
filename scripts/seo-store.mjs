import { SeoError } from './seo-settings.mjs'

// Redis records have no expiry. Only short-lived generation locks use EX.
export const SAVE = `
local existing = redis.call('GET', KEYS[1])
if existing then return existing end
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return false end
redis.call('SET', KEYS[1], ARGV[2], 'NX')
redis.call('DEL', KEYS[2])
return redis.call('GET', KEYS[1])`
export const RELEASE = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`

export function createStore(env = process.env, fetchImpl = fetch) {
  const token = env.UPSTASH_REDIS_REST_TOKEN?.trim()
  let url
  try { url = new URL(env.UPSTASH_REDIS_REST_URL) } catch { throw new SeoError('UPSTASH_REDIS_REST_URL is required for persistent AI descriptions') }
  if (!token || url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new SeoError('Invalid Upstash REST URL/token configuration')
  }
  async function command(args) {
    let response
    try { response = await fetchImpl(url.href, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) }) }
    catch { throw new SeoError('Redis connection/timeout failure; deployment stopped', 'storage') }
    if (!response.ok) {
      await response.body?.cancel()
      throw new SeoError(`Redis HTTP ${response.status}; deployment stopped`, 'storage')
    }
    let data
    try { data = await response.json() } catch { throw new SeoError('Invalid Redis response', 'storage') }
    if (data?.error || !data || !Object.hasOwn(data, 'result')) throw new SeoError('Redis command failed; deployment stopped', 'storage')
    return data.result
  }
  return {
    async readMany(keys) {
      if (!keys.length) return []
      const result = await command(['MGET', ...keys])
      if (!Array.isArray(result) || result.length !== keys.length) throw new SeoError('Invalid Redis MGET response', 'storage')
      return result
    },
    read: key => command(['GET', key]),
    async acquire(key, token, seconds) { return (await command(['SET', key, token, 'NX', 'EX', seconds])) === 'OK' },
    save: (key, lock, token, record) => command(['EVAL', SAVE, 2, key, lock, token, JSON.stringify(record)]),
    release: (lock, token) => command(['EVAL', RELEASE, 1, lock, token]),
  }
}
