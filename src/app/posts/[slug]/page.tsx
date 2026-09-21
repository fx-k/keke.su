import { bundleMDX } from 'mdx-bundler'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import remarkUnwrapImages from 'remark-unwrap-images'
import remarkDirective from 'remark-directive'
import remarkAdmonitions from '@/lib/unified/remark-admonitions'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import remarkReadingTime from 'remark-reading-time'
import remarkReadingMdxTime from 'remark-reading-time/mdx'
import remarkMdxCodeProps from '@/lib/unified/remark-mdx-code-props'
import remarkLinkCard from '@/lib/unified/remark-link-card'
import remarkImageInfo from '@/lib/unified/remark-image-info'
import { visit } from 'unist-util-visit'
import type { Plugin } from 'unified'
import { Element, Root, Text } from 'hast'
import path from 'path'
import {
  getAdjacentPosts,
  getAllPosts,
  getPostFrontmatter,
  getPostSlug,
  isPostExists,
} from '@/common/post'
import { Metadata } from 'next'
import config from 'config'
import { Heading } from '@/components/TableOfContents'
import { getImageInfo } from '@/common/image'
import { getPostDescription } from '@/common/seo'
import { blogPosting, safeJson } from '@/common/seo-utils'
import { getSiteUrl } from '@/common/url'
import PostPage from './PostPage'
import AutoRefresh from './AutoRefresh'
import { redirect } from 'next/navigation'

export async function generateStaticParams() {
  const posts = await getAllPosts()

  return Array.from(posts).map(post => ({
    slug: getPostSlug(post),
  }))
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug)

  const isExists = await isPostExists(slug)
  if (!isExists) return {}

  const frontmatter = await getPostFrontmatter(slug)
  const description = await getPostDescription(slug)

  return {
    title: frontmatter.title,
    description,
    openGraph: {
      title: frontmatter.title,
      description,
      images: '/api/og',
    },
    alternates: {
      types: {
        'application/rss+xml': [{ url: 'feed.xml', title: 'RSS Feed' }],
      },
      canonical: '/posts/' + slug + '.html',
    },
  } satisfies Metadata
}

export default async function Post({ params }: { params: { slug: string } }) {
  const slug = decodeURIComponent(params.slug)
  const headings: Heading[] = []

  const isExists = await isPostExists(slug)
  if (!isExists) redirect('/404')

  const { code, frontmatter } = await bundleMDX<PostFrontmatter>({
    file: path.join(process.cwd(), `posts/${slug}.mdx`),
    cwd: path.join(process.cwd(), 'posts'),
    mdxOptions(options, frontmatter) {
      // this is the recommended way to add custom remark/rehype plugins:
      // The syntax might look weird, but it protects you in case we add/remove
      // plugins in the future.
      options.remarkPlugins = [
        ...(options.remarkPlugins ?? []),
        remarkGfm,
        remarkUnwrapImages,
        remarkDirective,
        remarkAdmonitions,
        remarkMath,
        remarkReadingTime,
        remarkReadingMdxTime,
        remarkMdxCodeProps,
        remarkLinkCard,
        remarkImageInfo,
      ]
      options.rehypePlugins = [
        ...(options.rehypePlugins ?? []),
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: 'wrap', properties: { class: 'anchor' } }],
        rehypeKatex,
      ]

      if (frontmatter.toc ?? config.toc) {
        options.rehypePlugins.push((() => tree => {
          visit(tree, 'element', (node: Element, idx, parent) => {
            if (['h2', 'h3', 'h4', 'h5', 'h6'].includes(node.tagName) && parent?.type === 'root') {
              headings.push({
                id: node.properties!.id as string,
                text: ((node.children[0] as Element).children[0] as Text).value,
                level: Number(node.tagName.substring(1)),
              })
            }
          })
        }) as Plugin<[], Root>)
      }

      return options
    },
    esbuildOptions(options, frontmatter) {
      options.target = ['es2015']

      return options
    },
  })

  const { prev, next } = await getAdjacentPosts(slug)
  const heroImageInfo = frontmatter.image
    ? await getImageInfo(frontmatter.image)
    : undefined
  const structuredData = blogPosting({
    title: frontmatter.title,
    description: await getPostDescription(slug),
    url: getSiteUrl(`/posts/${slug}.html`).href,
    author: config.name,
    authorUrl: getSiteUrl('/').href,
    language: config.language || 'zh-CN',
    image: frontmatter.image,
    date: frontmatter.date,
    updatedOn: frontmatter.updatedOn,
  })

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(structuredData) }} />
      <PostPage
        slug={slug}
        code={code}
        frontmatter={frontmatter}
        headings={headings}
        heroImageInfo={heroImageInfo}
        prevPost={prev ? { link: `/posts/${prev.slug}.html`, title: prev.frontmatter.title } : undefined}
        nextPost={next ? { link: `/posts/${next.slug}.html`, title: next.frontmatter.title } : undefined}
      />
      <AutoRefresh />
    </>
  )
}
