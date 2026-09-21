import { getLatestPosts } from '@/common/post'
import Profile from '@/components/Profile'
import PostList from '@/components/PostList'
import React from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

// Only tags present in published articles have a page in this deployment.
export const dynamicParams = false

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const tag = decodeURIComponent(params.slug)
  const posts = await getLatestPosts()
  if (!posts.some(post => post.frontmatter.tags?.includes(tag))) notFound()

  return { title: tag }
}

export async function generateStaticParams() {
  const posts = await getLatestPosts()
  const tags = new Set<string>()

  for (const post of posts) {
    for (const tag of post.frontmatter.tags || []) {
      tags.add(tag)
    }
  }

  return Array.from(tags).map(tag => ({
    slug: tag,
  }))
}

export default async function PostsByTag({ params }: { params: { slug: string } }) {
  const { slug } = params
  const tag = decodeURIComponent(slug)
  const posts = await getLatestPosts()
  const matchingPosts = posts.filter(post => post.frontmatter.tags?.includes(tag))
  if (matchingPosts.length === 0) notFound()

  return (
    <div className="prose-container">
      <Profile />
      <h2 className="font-medium text-2xl before:content-['#_'] before:text-primary">{tag}</h2>
      <PostList
        posts={matchingPosts}
        dateFormat="MMMM D, YYYY"
      />
    </div>
  )
}
