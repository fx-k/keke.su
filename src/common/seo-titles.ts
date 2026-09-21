import config from 'config'
import zh from '@/locales/zh-CN.json'
import en from '@/locales/en.json'

export function navigationTitle(page: 'posts' | 'tags' | 'friends'): string {
  const messages = config.language === 'en' ? en : zh
  return messages[`nav.${page}`]
}
