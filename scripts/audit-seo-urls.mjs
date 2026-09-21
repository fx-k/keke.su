// Read-only live checks. This does not submit URLs or change routing.
const paths = [
  'http://keke.su/', 'https://keke.su/',
  'http://www.keke.su/', 'https://www.keke.su/',
  'https://keke.su/posts', 'https://keke.su/posts/',
  'https://keke.su/posts/2026-09-20-new-1.html',
  'https://keke.su/posts/2026-09-20-new-1',
  'https://keke.su/posts/2026-09-15-new-1.html',
  'https://keke.su/posts/2026-09-20-new-1.html?utm_source=seo-audit',
  'https://keke.su/posts/__seo-audit-missing-20260921.html',
  'https://keke.su/robots.txt', 'https://keke.su/sitemap.xml',
]
const results = []
for (const input of paths) {
  const result = { input, hops: [] }
  try {
    let url = input
    for (let i = 0; i < 6; i++) {
      if (!['keke.su', 'www.keke.su'].includes(new URL(url).hostname)) {
        throw new Error('Redirect leaves audited hosts')
      }
      const response = await fetch(url, {
        redirect: 'manual', signal: AbortSignal.timeout(15000),
        headers: { 'User-Agent': 'keke-seo-audit/1.0' },
      })
      const location = response.headers.get('location')
      result.hops.push({ url, status: response.status, location })
      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        await response.body?.cancel()
        url = new URL(location, url).href
        continue
      }
      const body = await response.text()
      result.finalUrl = url
      result.contentType = response.headers.get('content-type')
      result.xRobotsTag = response.headers.get('x-robots-tag')
      result.title = body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null
      const tags = body.match(/<link\b[^>]*>/gi) || []
      result.canonical = tags.filter(t => /\brel=["']canonical["']/i.test(t))
        .map(t => t.match(/\bhref=["']([^"']*)["']/i)?.[1])
      result.lang = body.match(/<html\b[^>]*\blang=["']([^"']*)/i)?.[1] ?? null
      result.robots = (body.match(/<meta\b[^>]*>/gi) || [])
        .filter(t => /\bname=["'](?:robots|googlebot)["']/i.test(t))
      if (url.endsWith('robots.txt')) result.body = body.slice(0, 4000)
      if (url.endsWith('sitemap.xml')) {
        result.urlCount = (body.match(/<loc>/g) || []).length
        result.lastmodSample = [...body.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].slice(0, 8).map(m => m[1])
        result.latestArticlesPresent = ['2026-09-20-new-1.html', '2026-09-15-new-1.html']
          .map(slug => ({ slug, present: body.includes(slug) }))
      }
      break
    }
    if (!result.finalUrl) throw new Error('Redirect limit exceeded')
  } catch (error) {
    result.error = `${error.name}: ${error.message}; ${error.cause?.code || ''}`
  }
  results.push(result)
  console.log(JSON.stringify(result))
}
const { writeFile } = await import('node:fs/promises')
await writeFile('seo-url-audit.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n')
// Individual errors are evidence, not a claim that all hosts passed.
