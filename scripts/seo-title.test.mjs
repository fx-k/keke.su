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
  const code = ts.transpileModule(`module.exports = (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
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
function metadataFunction(path, extra = {}) {
  const ast = source(path)
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'generateMetadata')
  assert.ok(fn)
  return evaluate(fn.getText(ast).replace(/^export\s+/, ''), extra)
}
const root = staticMetadata('src/app/layout.tsx')
const withBrand = title => root.title.template.replace('%s', title)
test('root uses the configured separator and home brand', () => {
  assert.equal(root.title.default, config.title)
  assert.equal(root.title.template, `%s | ${config.title}`)
  assert.equal(root.openGraph.images, '/api/og')
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
  const generate = metadataFunction('src/app/tags/[slug]/page.tsx')
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
