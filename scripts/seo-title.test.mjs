// Contract tests of the actual metadata exports. No server/API or article writes.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const config = require('../site.config.js')
const context = { config, getSiteUrl: (path = '/') => new URL(path, config.siteUrl) }
function source(path) {
  return ts.createSourceFile(path, fs.readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}
function evaluate(expression, extra = {}) {
  const code = ts.transpileModule(`module.exports = (${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(code, { module, ...context, ...extra }, { timeout: 1000 })
  return module.exports
}
function staticMetadata(path) {
  const ast = source(path)
  for (const statement of ast.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(ast) === 'metadata' && declaration.initializer) {
        return evaluate(declaration.initializer.getText(ast))
      }
    }
  }
  throw new Error(`No metadata export in ${path}`)
}
function metadataFunction(path, extra = {}) {
  const ast = source(path)
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'generateMetadata')
  assert.ok(fn, `No generateMetadata export in ${path}`)
  return evaluate(fn.getText(ast).replace(/^export\s+/, ''), extra)
}
const root = staticMetadata('src/app/layout.tsx')
const withBrand = title => root.title.template.replace('%s', title)

test('root has a single brand default and a shared child-title template', () => {
  assert.equal(root.title.default, config.title)
  assert.equal(root.title.template, `%s｜${config.title}`)
  assert.equal(root.openGraph.images, '/api/og')
})
test('archive, tag index and friends use leaf labels without a duplicate brand', () => {
  for (const [file, label] of [
    ['src/app/posts/page.tsx', '文章归档'],
    ['src/app/tags/page.tsx', '标签'],
    ['src/app/friends/layout.tsx', '友情链接'],
  ]) {
    const metadata = staticMetadata(file)
    assert.equal(metadata.title, label)
    assert.equal(withBrand(metadata.title), `${label}｜${config.title}`)
  }
})
test('a Chinese tag uses its own decoded name', async () => {
  const generate = metadataFunction('src/app/tags/[slug]/page.tsx')
  const metadata = await generate({ params: { slug: encodeURIComponent('技术向') } })
  assert.equal(metadata.title, '技术向')
  assert.equal(withBrand(metadata.title), `技术向｜${config.title}`)
})
test('article title is unchanged before applying the root template; OG image is unchanged', async () => {
  const title = '万物皆可Plugin —— 将腾讯云 DNSPod 接入 ChatGPT Plugin'
  const generate = metadataFunction('src/app/posts/[slug]/page.tsx', {
    isPostExists: async () => true,
    getPostFrontmatter: async () => ({ title }),
    getPostDescription: async () => 'An independent description used only for this metadata contract test.',
  })
  const metadata = await generate({ params: { slug: '2026-09-20-new-1' } })
  assert.equal(metadata.title, title)
  assert.equal(withBrand(metadata.title), `${title}｜${config.title}`)
  assert.equal(metadata.openGraph.title, title)
  assert.equal(metadata.openGraph.images, '/api/og')
  assert.equal(metadata.alternates.canonical, '/posts/2026-09-20-new-1.html')
})
test('friends metadata is server-side without converting the existing client page', () => {
  assert.match(fs.readFileSync('src/app/friends/page.tsx', 'utf8'), /^'use client'/)
  assert.doesNotMatch(fs.readFileSync('src/app/friends/layout.tsx', 'utf8'), /['"]use client['"]/)
})
