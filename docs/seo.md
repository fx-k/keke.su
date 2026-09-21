# SEO 配置与构建

## 快速使用

构建命令为 `npm run build`，先准备摘要，再执行 `next build`；使用 Vercel 原生 Git 部署即可。默认未配置 AI Key 时，为每篇文章生成独立正文摘录，无模型调用或摘要数据库访问。计数、评论等功能按其各自要求配置。

全局 AI 摘要选项在 `site.config.js` 的 `ai_desc_gen` 中。每个选项均有默认值、可选值或范围及行为注释。浏览器标题复用 `src/locales` 的导航名称，格式固定为“页面名称 | 站名”；首页只显示站名。标题样式与 AI 摘要设置独立。生成器不修改页面正文或 MDX frontmatter。

## 配置

| 字段 | 默认值 | 含义 |
| --- | --- | --- |
| mode | auto | auto：有 Key 启用 AI、无 Key 使用摘录；ai：要求 AI 接入配置；extractive：只用摘录，不读写摘要数据库。 |
| onAIError | fail-build | fail-build：调用失败停止构建；fallback-extractive：调用失败的文章使用摘录并明确警告。 |
| maxLength | 160 | 新生成摘要的字符上限，整数 20～160；包括英文、标点和空格。 |
| maxGenerationsPerBuild | 200 | 单次构建尝试生成的文章数，整数 1～500；复用记录不计入。 |
| timeoutMs | 60000 | 单次模型请求超时，整数 1000～120000 毫秒。 |
| maxRetries | 2 | 网络、429、5xx 的额外重试次数，整数 0～3；其他上游 HTTP 错误不重试。 |
| prompt | 全局配置中的文本 | 摘要文风提示词，最多 16000 字符。 |

摘要没有适用于所有语言、查询和设备的最佳字符数。Google 可能按设备宽度截断，也可能用正文另行生成搜索摘要。160 是本项目的输出上限，不是排名规则或完整展示保证。默认文风建议一至两句、约 80～130 个字符，以准确概括和可读性为先，实际请求上限优先。

`maxLength` 和提示词只约束新生成结果；有效的已保存文本不因配置变动而被截断或重写。

## 模型接入

Vercel 环境变量中设置 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、`OPENAI_MODEL`，以及 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`。默认 API 地址为 `https://api.openai.com/v1`。自定义服务需支持 Chat Completions、配置的文本模型和 `max_completion_tokens`。秘密不得写入全局配置或使用 NEXT_PUBLIC_ 前缀，参见 `.env.example`。

模式、提示词和失败策略只从 `ai_desc_gen` 读取，不需要额外的摘要模式环境变量。auto 只在启动时决定是否使用 AI：Key 存在时，之后的 AI 调用失败与 ai 模式执行相同的 onAIError，不会绕开策略自动退回摘录。

Vercel Preview 内置为只读：可读取匹配的正式摘要，缺失时使用摘录，不创建摘要记录、不获取生成锁、不调用付费模型。这是预览保护，不是生产 AI 失败后的降级；预览完成不代表正式 AI 覆盖完成。只给受信任的环境及分支提供凭据。本地开发默认离线摘录。

## 持久数据

Upstash Redis 是 AI 摘要唯一持久源。记录没有 TTL，数据库必须关闭 Eviction，并安排备份。构建脚本不会自动修改数据库管理设置。

记录身份由站点 origin、文章 slug 与文章内容哈希确定，不包含模型、Key、提示词或构建时间。更改模型或提示词不会自动改写已保存的同内容摘要。文章内容改变才会生成相应的新记录，旧内容版本的记录保留。删除文章或改为草稿不会发起生成，也不会自动删除已有数据库记录。

构建批量读取 Redis；确认记录不存在时才调用 AI。新结果必须校验并保存成功，才能用于页面。摘要通过短期锁和原子保存控制并发，同一记录使用已保存的结果。崩溃、超时或租约到期仍可能造成重复模型调用，不能承诺精确一次计费。

编译输入 `src/generated/seo-build.js` 在每次构建时删除并重建，被 Git 忽略，不作为记录恢复或数据库故障备用来源。页面使用当次构建的固化结果，不在访问时为摘要连接 Redis 或调用 AI。浏览量、点赞和限流仍遵循各自的运行时逻辑。

## 失败处理

默认 fail-build 在 AI 失败时停止构建。选择 fallback-extractive 后，上游 HTTP 错误（包括 400/401/403/404）、超时、限流、服务错误、拒绝或不合格输出都可以让对应文章使用正文摘录，日志明确提示错误。非重试类 HTTP 错误直接交给策略处理，不反复重试。摘录不写入 Redis、不计为 AI 成功，下次构建仍可尝试生成；已有匹配的 AI 摘要不受影响。

本地配置错误（未知字段、非法枚举、缺少必需模型配置、非法 API 地址）以及 Redis 读写错误、损坏记录始终停止构建。数据库错误不能当作“未找到记录”，也不能用新文案替代已保存文本。

达到单次生成上限后，同样按 onAIError 停止或使用摘录并报告未处理数量。首次生成可能覆盖所有已发布文章，费用以服务商账单为准。`[seo] SUMMARY` 包含文章数、复用数、生成数、降级数、失败数、请求数与网关报告的 Token 用量，不输出秘密。

## 验证

```bash
npm ci
npm run test:seo
npm run seo:check  # 离线准备，不访问 AI/Redis
npx tsc --noEmit
npm run build
```

模型输入为标题、标签和最多 12000 字符的清理后正文，不含图片文件或代码块；格式检查不等于事实审校。上线时应抽查文案及真实 HTML 的 title、description、BlogPosting、canonical、日期和正文。

`node scripts/prepare-seo.mjs --check` 可在完整准备后再次读取并比较 Redis 中的记录，第二次读取禁止调用模型。清空构建缓存后仍应逐字复用原摘要。数据库不可用时构建应停止，不影响已经发布的页面摘要。

Sitemap lastmod 与 BlogPosting dateModified 使用文章有效的 updatedOn/date，不使用摘要生成时间。结构化数据及 description 不保证收录、排名或某种搜索展示。

参考：
- https://vercel.com/docs/builds/configure-a-build
- https://upstash.com/docs/redis/features/restapi
- https://upstash.com/docs/redis/features/eviction
- https://developers.google.com/search/docs/appearance/snippet
