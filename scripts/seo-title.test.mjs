import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const config = require('../site.config.js')
const zh = require('../src/locales/zh-CN.json'), en = require('../src/locales/en.json')
const context = { config, zh, en, getSiteUrl: (path = '/') => new URL(path, config.siteUrl) }
function source(path) { return ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX) }
function evaluate(expression, extra = {}) {
  const code = ts.transpileModule(`module.exports = (${expression});`, {
    fileName: 'route-test.tsx',
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(code, { module, ...context, ...extra }, { timeout: 1000 })
  return module.exports
}
const titleAst = source('src/common/seo-titles.ts')
const titleFn = titleAst.statements.find(n => ts.isFunctionDeclaration(n))
context.navigationTitle = evaluate(titleFn.getText(titleAst).replace(/^export\s+/, ''))
function staticMetadata(path) {
  const ast = source(path)
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(ast) === 'metadata' && declaration.initializer) return evaluate(declaration.initializer.getText(ast))
    }
  }
  throw new Error(`No metadata export in ${path}`)
}
function routeFunction(path, name, extra = {}) {
  const ast = source(path)
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)
  assert.ok(fn, `Missing ${name} in ${path}`)
  return evaluate(fn.getText(ast).replace(/^export\s+(?:default\s+)?/, ''), extra)
}
function metadataFunction(path, extra = {}) { return routeFunction(path, 'generateMetadata', extra) }
const root = staticMetadata('src/app/layout.tsx')
const withBrand = title => root.title.template.replace('%s', title)
test('root fixes the title separator independently of AI configuration', () => {
  assert.equal(root.title.default, config.title)
  assert.equal(root.title.template, `%s | ${config.title}`)
  assert.equal(root.openGraph.images, '/api/og')
  assert.doesNotMatch(fs.readFileSync('src/app/layout.tsx', 'utf8'), /titleSeparator|ai_desc_gen|config\.seo/)
})
test('page labels are identical to navigation locale values', () => {
  for (const [file, section] of [['src/app/posts/page.tsx', 'posts'], ['src/app/tags/page.tsx', 'tags'], ['src/app/friends/layout.tsx', 'friends']]) {
    assert.equal(staticMetadata(file).title, zh[`nav.${section}`])
    assert.equal(withBrand(staticMetadata(file).title), `${zh[`nav.${section}`]} | ${config.title}`)
  }
})
test('locale function also supports English navigation', () => {
  const fn = evaluate(titleFn.getText(titleAst).replace(/^export\s+/, ''), { config: { language: 'en' } })
  assert.equal(fn('posts'), en['nav.posts'])
})
test('tag page uses the decoded tag name', async () => {
  const generate = metadataFunction('src/app/tags/[slug]/page.tsx', {
    getLatestPosts: async () => [{ frontmatter: { tags: ['技术向'] } }],
    notFound: () => assert.fail('Existing tag must not return 404'),
  })
  assert.equal(withBrand((await generate({ params: { slug: encodeURIComponent('技术向') } })).title), `技术向 | ${config.title}`)
})
test('article metadata preserves the article title, canonical and OG image', async () => {
  const title = '万物皆可Plugin —— 将腾讯云 DNSPod 接入 ChatGPT Plugin'
  const generate = metadataFunction('src/app/posts/[slug]/page.tsx', {
    isPostExists: async () => true, getPostFrontmatter: async () => ({ title }), getPostDescription: async () => 'test description',
  })
  const metadata = await generate({ params: { slug: '2026-09-20-new-1' } })
  assert.equal(metadata.title, title)
  assert.equal(withBrand(metadata.title), `${title} | ${config.title}`)
  assert.equal(metadata.openGraph.title, title)
  assert.equal(metadata.openGraph.images, '/api/og')
  assert.equal(metadata.alternates.canonical, '/posts/2026-09-20-new-1.html')
})
test('friends client page is unchanged by its server metadata wrapper', () => {
  assert.match(fs.readFileSync('src/app/friends/page.tsx', 'utf8'), /^'use client'/)
  assert.doesNotMatch(fs.readFileSync('src/app/friends/layout.tsx', 'utf8'), /['"]use client['"]/)
})

// These tests execute the actual route guards with isolated data, not network services.
const articleRoute = 'src/app/posts/[slug]/page.tsx'
const tagRoute = 'src/app/tags/[slug]/page.tsx'
const missing = Object.freeze({ digest: 'NEXT_NOT_FOUND' })
const notFound = () => { throw missing }
const taggedPosts = [
  { slug: 'one', frontmatter: { tags: ['技术向', '随笔'] } },
  { slug: 'two', frontmatter: { tags: ['技术向'] } },
  { slug: 'three', frontmatter: {} },
]

test('article and tag routes return 404 for parameters outside the static route list', () => {
  for (const file of [articleRoute, tagRoute]) {
    const ast = source(file)
    const statement = ast.statements.find(n => ts.isVariableStatement(n) &&
      n.declarationList.declarations.some(d => d.name.getText(ast) === 'dynamicParams'))
    assert.ok(statement?.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword))
    const declaration = statement.declarationList.declarations.find(d => d.name.getText(ast) === 'dynamicParams')
    assert.equal(declaration.initializer?.kind, ts.SyntaxKind.FalseKeyword)
  }
})
test('missing article metadata stops before reading frontmatter or descriptions', async () => {
  const generate = metadataFunction(articleRoute, {
    isPostExists: async () => false, notFound,
    getPostFrontmatter: () => assert.fail('Missing article frontmatter was read'),
    getPostDescription: () => assert.fail('Missing article description was read'),
  })
  await assert.rejects(generate({ params: { slug: '__missing__' } }), error => error === missing)
})
test('missing article rendering stops before importing link cards or bundling MDX', async () => {
  const render = routeFunction(articleRoute, 'Post', {
    isPostExists: async () => false, notFound,
    bundleMDX: () => assert.fail('Missing article MDX was compiled'),
    require: () => assert.fail('Missing article imported a rendering dependency'),
  })
  await assert.rejects(render({ params: { slug: '__missing__' } }), error => error === missing)
})
test('link-card runtime dependencies are not loaded as a top-level article import', () => {
  const ast = source(articleRoute)
  const staticImports = ast.statements.filter(ts.isImportDeclaration).map(n => n.moduleSpecifier.text)
  assert.ok(!staticImports.includes('@/lib/unified/remark-link-card'))
  const render = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'Post').getText(ast)
  assert.ok(render.indexOf('notFound()') < render.indexOf("import('@/lib/unified/remark-link-card')"))
  assert.ok(render.includes("import('@/lib/unified/remark-link-card')"))
  assert.ok(!staticImports.includes('fetch-site-metadata'))
})
test('missing tag metadata does not generate a success title', async () => {
  const generate = metadataFunction(tagRoute, { getLatestPosts: async () => taggedPosts, notFound })
  await assert.rejects(generate({ params: { slug: '__missing__' } }), error => error === missing)
})
test('missing tag rendering does not produce an empty success page', async () => {
  const render = routeFunction(tagRoute, 'PostsByTag', { getLatestPosts: async () => taggedPosts, notFound })
  await assert.rejects(render({ params: { slug: '__missing__' } }), error => error === missing)
})
test('existing tag page retains its exact matching article list', async () => {
  const render = routeFunction(tagRoute, 'PostsByTag', {
    getLatestPosts: async () => taggedPosts,
    notFound: () => assert.fail('Existing tag must not return 404'),
    React: { createElement: (type, props, ...children) => ({ type, props, children }) },
    Profile: 'Profile', PostList: 'PostList',
  })
  const page = await render({ params: { slug: encodeURIComponent('技术向') } })
  const list = page.children.find(child => child.type === 'PostList')
  assert.equal(JSON.stringify(list.props.posts.map(post => post.slug)), JSON.stringify(['one', 'two']))
  assert.equal(list.props.dateFormat, 'MMMM D, YYYY')
})
test('static article enumeration retains every source slug', async () => {
  const generate = routeFunction(articleRoute, 'generateStaticParams', {
    getAllPosts: async () => ['posts/old.mdx', 'posts/new.mdx'],
    getPostSlug: file => file.replace(/^posts\/|\.mdx$/g, ''),
  })
  assert.equal(JSON.stringify(await generate()), JSON.stringify([{ slug: 'old' }, { slug: 'new' }]))
})
test('static tag enumeration retains and deduplicates the published tag names', async () => {
  const generate = routeFunction(tagRoute, 'generateStaticParams', { getLatestPosts: async () => taggedPosts })
  assert.equal(JSON.stringify(await generate()), JSON.stringify([{ slug: '技术向' }, { slug: '随笔' }]))
})
