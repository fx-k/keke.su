import React from 'react'
import { getLatestPosts } from '@/common/post'
import TagsPage from './TagsPage'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '标签',
}

async function getTags() {
  const posts = await getLatestPosts({ orderBy: 'asc' })
  const tags: Record<
    string,
    {
      tagName: string
      postsNum: number
    }
  > = {}

  for (const post of posts) {
    for (const t of post.frontmatter.tags || []) {
      if (!tags[t]) tags[t] = { tagName: t, postsNum: 0 }
      tags[t].postsNum++
    }
  }

  return Object.values(tags)
}

export default async function Tags() {
  const tags = await getTags()
  return <TagsPage tags={tags} />
}
