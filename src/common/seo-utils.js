const { createHash } = require('node:crypto')
const PROMPT_VERSION = 'description-v1'

function plainText(body) {
  return String(body || '')
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*(?:import|export)\s+.*$/gm, ' ')
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+\.\s+)/gm, '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[`*_~]/g, '')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim()
}

function truncate(text, length = 160) {
  const chars = Array.from(text)
  return chars.length <= length ? text : chars.slice(0, length - 1).join('') + '…'
}

function fallbackDescription(title, body) {
  const heading = plainText(title)
  const text = plainText(body)
  // Include the title to distinguish even posts with similar introductions.
  return truncate(text.startsWith(heading) && heading ? text : `${heading}。${text}`)
}

function sourceHash(title, tags, body) {
  return createHash('sha256')
    .update(JSON.stringify([PROMPT_VERSION, title, tags, String(body || '').replace(/\r\n/g, '\n')]))
    .digest('hex')
}

function validDescription(value) {
  return typeof value === 'string' && value === value.trim() &&
    Array.from(value).length >= 20 && Array.from(value).length <= 160 &&
    !/[\r\n<>]|```|https?:\/\//i.test(value)
}

function parseDescriptionResponse(content) {
  if (typeof content !== 'string') throw new Error('Missing model response text')
  const data = JSON.parse(content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''))
  if (!data || !validDescription(data.description)) throw new Error('Invalid description')
  return data.description
}

function isoDate(value) {
  if (!(typeof value === 'string' || value instanceof Date)) return undefined
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}(?:T|$|\s)/.test(value)) return undefined
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : undefined
}

function postDates(frontmatter) {
  const published = isoDate(frontmatter.date)
  const updated = isoDate(frontmatter.updatedOn)
  const modified = published && updated ? (published > updated ? published : updated) : updated || published
  return { published, modified }
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

function blogPosting({ title, description, url, author, authorUrl, language, image, date, updatedOn }) {
  const dates = postDates({ date, updatedOn })
  let imageUrl
  try {
    const parsed = new URL(image, url)
    if (typeof image === 'string' && /^(?:https?:\/\/|\/)/.test(image) && /^https?:$/.test(parsed.protocol)) imageUrl = parsed.href
  } catch { /* Missing or placeholder image: omit rather than invent one. */ }
  return {
    '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': `${url}#article`,
    headline: title, description, url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Person', name: author, url: authorUrl },
    inLanguage: language,
    ...(dates.published ? { datePublished: dates.published } : {}),
    ...(dates.modified ? { dateModified: dates.modified } : {}),
    ...(imageUrl ? { image: [imageUrl] } : {}),
  }
}

module.exports = { PROMPT_VERSION, plainText, truncate, fallbackDescription, sourceHash,
  validDescription, parseDescriptionResponse, isoDate, postDates, safeJson, blogPosting }
