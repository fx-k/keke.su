# SEO 配置与构建

## 快速使用

站点保留 Vercel 原生 Git 部署。构建命令为 `npm run build`，先准备摘要，再执行 `next build`。没有 AI Key 时，默认使用每篇文章的正文摘录，无模型调用和摘要数据库访问。原有计数、评论等功能仍按其各自文档配置。

全局选项位于 `site.config.js` 的 `seo` 部分，每个选项均有可选值、范围和行为说明。标题复用 `src/locales` 的导航文案，默认分隔符为 ` | `。页面正文和 MDX frontmatter 不由 SEO 生成器修改。

## 可选 AI

在 Vercel 项目的环境变量中设置 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`，以及已有的 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。模型名必须是服务商支持的文本模型。默认 API 地址是 `https://api.openai.com/v1`；自定义服务需支持 Chat Completions 与 `max_completion_tokens`。秘密不得写入 site.config.js，不得使用 NEXT_PUBLIC_ 前缀。参见根目录 `.env.example`。

不需要配置额外的摘要模式环境变量。`mode`、提示词和故障策略只从 site.config.js 读取。

- `auto`：有 Key 使用 AI，无 Key 使用正文摘录。
- `ai`：缺少凭据或模型视为配置错误。
- `extractive`：不查询摘要数据库、不使用 AI 摘要。

只给受信任的 Vercel 环境/分支配置凭据。`Preview` 默认只读正式摘要，无缺失条目写入、无付费调用。`preview: 'isolated'` 可以做小样试跑，数据按分支及文风隔离，最多生成 `previewMaxGenerations` 篇，默认 2 篇。预览成功不代表正式环境已配置或历史文章已全部回填。

## 唯一持久数据源

Upstash Redis 保存正式 AI 摘要。记录不设置 TTL，启用前必须在 Upstash 关闭 Eviction。此数据库设置需要站点管理员在控制台核验，构建脚本不会更改数据库策略。容量满时应明确拒绝写入，而不是淘汰已保存的摘要；持久存储不等于备份，应自行配置备份。

存储命名空间由站点 origin 派生，只写 `seo:descriptions:v1:*` 下的摘要与短期锁，不改浏览量、点赞、限流键。文章内容哈希对应不可变摘要记录。回到旧文章版本可复用旧摘要；更换 Key、模型、编辑提示词或 CSS 不自动改写历史描述。记录保留生成时模型、提示词哈希及生成时间供追踪。

要有意识地重生成某一篇，在 `revisions` 中为该文章指定更高的正整数，例如 `{ 'my-post': 2 }`，重新构建即可。旧记录保留。删除原文或转草稿的文章不会参与生成，也不会因此自动删除历史记录。

同一文章同一版本的并行生成使用带过期的锁；正式记录无过期。保存时以 Lua 校验锁所有权并写入一次，其他构建读取已保存的结果。崩溃、网络响应丢失或租约到期仍可能造成重复模型调用，不能承诺精确一次计费；但未成功保存的结果不会被发布，不以最后完成者覆盖已保存文字。

## 构建与访问

构建时批量从 Redis 读取记录；缺失版本才生成、校验并保存。保存成功后汇总成当前构建的 `src/generated/seo-build.js`，这是被 Git 忽略的编译输入，每次构建都会删除并重建，永远不作为读取持久数据的来源。它不包含 Key、Token 或原文章内容，不能用来恢复 Redis。

HTML、BlogPosting 与部署中的服务端模块使用当次构建的固化结果。访客访问时，摘要逻辑不连接 Redis、不调用模型。网站原有浏览量与点赞 API 仍有自己的 Redis 访问，行为不变。

清空构建缓存后，仍从 Redis 读回已保存摘要，不重新生成。Redis 读写失败或记录损坏始终停止构建，不能当作摘要不存在。数据库数据实际被删除时无法凭空恢复，需从数据库备份恢复。

## 模型失败

`fail-build` 会停止当前构建；`fallback-extractive` 会对模型超时、429、5xx、输出不合格的文章使用摘录并记录警告。摘录不写入 Redis，也不计为 AI 成功，下次构建仍可重试。非法配置、HTTP 鉴权/参数错误和数据库错误不允许降级。已有内容匹配的摘要原样使用。

每次构建的文章生成上限只计需要生成的文章，不计读取命中的文章；单篇请求有超时与有限重试。达到上限后按所选策略停止或降级。首次历史回填可能涉及所有已发布文章，费用按服务商账单计算。控制台输出 `[seo] SUMMARY`，包含文章数、复用、生成、失败、延期、摘录数及网关报告的 token 用量，不输出秘密。

新摘要风格是从原文实际动机切入，再说明做法；无明确动机时不编造。模型收到标题、标签和最多 12000 字符的清理后正文，不包括图片文件及代码块。格式验证不等于事实审校，正式启用前应抽查技术文和随笔。

## 元数据

文章 sitemap lastmod 和 BlogPosting dateModified 使用有效 updatedOn/date，不采用构建时间或摘要生成时间。日期缺失时省略。标题保持原文，JSON-LD 使用 https://schema.org 并安全序列化，canonical 仍使用站点的既有文章 URL 规则。结构化数据和描述不保证收录、排名或特定搜索摘要。

## 验证

```bash
npm ci
npm run test:seo
npm run seo:check  # 仅生成本地摘录编译输入，不访问 API/Redis
npx tsc --noEmit
npm run build
```

本地 `npm run dev` 自动准备离线摘录，不花费 API 额度。正式构建可从 .env.local 加载凭据。手动执行 `node scripts/prepare-seo.mjs --check` 会在全量覆盖成功时再次从持久存储读取并比较结果；第二遍不允许调用模型。`--offline` 与 `--check` 是构建诊断参数，不覆盖全局在线配置。

上线前检查：实际 HTML 的 title、description、BlogPosting、canonical、日期和正文；在新的构建目录/清理构建缓存后验证原摘要逐字不变；模拟数据库故障验证构建停止。Preview 默认携带平台的 noindex，不将预览验证等同于生产部署。

参考：
- https://vercel.com/docs/builds/configure-a-build
- https://upstash.com/docs/redis/features/restapi
- https://upstash.com/docs/redis/features/eviction
- https://developers.google.com/search/docs/appearance/snippet
