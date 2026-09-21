export const PROMPT_VERSION: string
export function plainText(body: string): string
export function truncate(text: string, length?: number): string
export function fallbackDescription(title: string, body: string): string
export function sourceHash(title: string, tags: string[], body: string): string
export function validDescription(value: unknown): value is string
export function parseDescriptionResponse(content: unknown): string
export function isoDate(value: unknown): string | undefined
export function postDates(frontmatter: { date?: unknown; updatedOn?: unknown }): {
  published: string | undefined; modified: string | undefined
}
export function safeJson(value: unknown): string
export function blogPosting(options: {
  title: string; description: string; url: string; author: string; authorUrl: string;
  language: string; image?: string; date?: unknown; updatedOn?: unknown
}): Record<string, unknown>
