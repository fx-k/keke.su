module.exports = {
  name: 'Mr.Ke',
  title: '小可の聚集地', // 更改title将会影响artalkServer对应的配置
  alternateTitle: ["小可的博客", "Ke's Blog", "繁星博客"], // 更改title和alternateTitle将会影响Google站点的JSON-LD数据
  description: '可可酥，小可之地！！！',
  description_typing: [
    "🌹可以永远期待一切的双向奔赴...",
    "虚心学习🙏🙏争取向大佬迈进...",
    "Coding for sth new... 😎",
    "🧐Debug the world...",
  ],
  avatar: '/avatar.png',
  logo: '/logo.svg',
  favicon: '/favicon.ico',
  siteUrl: 'https://keke.su',
  // icon 请在 src/components/Profile.tsx 中修改
  getFaviconAPI: 'https://favicon-ico.vercel.app/?url=',
  artalkServer: 'https://cmt.keke.su',
  links: [
    { name: 'GitHub', link: 'https://github.com/fx-k' },
    { name: 'Moments', link: 'https://now.keke.su' },
    { name: 'Telegram', link: 'https://t.me/Mone_J' },
    { name: 'Mail', link: 'mailto:admin@fxit.top' },
    { name: 'RSS', link: '/feed.xml' },
  ],
  friends: [
    { name: '维基萌', link: 'http://www.wikimoe.com/' },
    { name: 'OMG的博客', link: 'https://ohmyga.cn/' },
    { name: 'HanCanonのBlog', link: 'https://blog.hancanon.com/' },
    { name: 'Diaoan\'s Blog', link: 'https://diaoan.xyz/' },
    { name: 'UsubeniFantasy', link: 'https://ssshooter.com/' },
    { name: 'Sukka\'s Blog', link: 'https://blog.skk.moe/' },
    { name: '香菇肥牛的博客', link: 'https://qing.su/' },
    { name: 'Thun888', link: 'https://blog.hzchu.top/' },
  ],
  friends_invalid: [
    { name: '遇见心流', link: 'http://yujianxinliu.com/' },
    { name: '苍灵冥梦', link: 'https://moe.do/' },
    { name: '矢澤にこ', link: 'https://blog.ni-co.moe/' },
    { name: '树洞', link: 'https://aoaoao.me/' },
    { name: '久伴博客', link: 'https://jiub.ren/' },
    { name: 'Sonic853', link: 'http://blog.853lab.com/' },
    { name: 'YellowBlue', link: 'https://yellowblue.top/' },
    { name: '光宇核心', link: 'https://starlightness.tech/' },
  ],
  projects: [
    {
      name: 'keke.su',
      desc: "小可の聚集地（本站已开源，帮我点点Star叭 orz）",
      url: 'https://github.com/fx-k/keke.su',
    },
    {
      name: '繁星MC服务器',
      desc: "Fancy World - 一个创立于2014年的MCPE(BE)公益服务器!",
      url: 'https://mc.fxit.top',
    },
    {
      name: 'FXCloud - 私有云',
      desc: "233456.xyz, 一个对外分享的私有云平台。",
      url: 'https://233456.xyz',
    },
    {
      name: 'Server Status - 探针',
      desc: "古人云，有朋自远方来，以针会友～",
      url: 'https://sys.stat.fxit.top',
    },
    {
      name: 'Service Uptime - 监控',
      desc: "监控，为了无法监控的价值...",
      url: 'https://ops.stat.fxit.top',
    },
    {
      name: '停止跟踪 - 净化分享链接',
      desc: "一键去除小红书/哔哩哔哩链接中的跟踪信息，并生成短链。",
      url: 'https://fwd.pp.ua/clean',
    },
  ],
  // en | zh-CN
  language: 'zh-CN',
  // 侧边目录
  toc: true,
  // 显示上一篇下一篇按钮
  adjacentPosts: true,
  // 配置文章过时提醒阈值
  outdatedPostThresholdDays: 90,
  markdown: {
    // 统一配置 CodeBlock 是否显示行号，也可以在 frontmatter 中通过 lineNumbers 字段单独设置
    lineNumbers: true,
  },
  backToTopButton: true,

  seo: {
    // 浏览器标题分隔符。默认 ' | '，例如：博客 | 小可の聚集地。
    // 页面名称使用 src/locales 中与导航相同的文案；首页只显示站名。
    titleSeparator: ' | ',
    description: {
      // 摘要模式（默认 'auto'）：
      // 'auto'：有 OPENAI_API_KEY 时启用 AI，没有时使用正文摘录。
      // 'ai'：要求 AI；缺少 Key 或模型配置时停止构建。
      // 'extractive'：仅使用正文摘录，不读取摘要数据库、不调用 AI。
      mode: 'auto',
      // 模型故障策略（默认 'fallback-extractive'）：
      // 'fail-build'：超时、限流、服务错误或输出不合格时停止构建。
      // 'fallback-extractive'：失败文章使用当前正文摘录，其余文章保留有效 AI 摘要。
      // 摘录不存为 AI 成功记录，下次构建仍会重试。
      // 配置错误、鉴权失败、Redis 读写失败始终停止构建，不受本选项影响。
      onAIError: 'fallback-extractive',
      // 新生成摘要的字符上限，整数 20～160，默认 160（包含英文、空格和标点）。
      // 过长的模型输出会被拒绝，不从句子中间截断；已保存的摘要保持原样。
      maxLength: 160,
      // 每次正式构建最多尝试生成的文章数，整数 1～500，默认 200。
      // 已有有效摘要不计入；单篇重试会增加 API 请求数。
      // 超过上限的文章按 onAIError 处理，日志明确报告未处理数量。
      maxGenerationsPerBuild: 200,
      // 单次 AI 请求超时，整数 1000～120000 毫秒，默认 60000。
      timeoutMs: 60000,
      // 网络、429、5xx 错误的额外重试次数，整数 0～3，默认 2。
      // 2 表示总计最多尝试 3 次；配置错误和鉴权失败不重试。
      maxRetries: 2,
      // Vercel Preview 行为（默认 'read-only'）：
      // 'read-only'：只读取正式摘要；缺失的文章使用摘录，不调用 AI、不写 Redis。
      // 'isolated'：在独立的预览命名空间内生成，正式摘要不会被覆盖。
      // 请仅给受信任的预览分支配置 API/Redis 凭据。
      preview: 'read-only',
      // isolated 预览最多生成的文章数，整数 1～10，默认 2，优先最新文章。
      // 其余文章使用摘录；预览试跑不代表全站 AI 摘要覆盖完成。
      previewMaxGenerations: 2,
      // 指定文章的重生成编号。键为文件名（不含 .mdx），值为正整数，默认 1。
      // 例如：{ '2026-09-20-new-1': 2 } 会为该文章生成第二版，旧记录保留。
      // 文章内容变化会生成对应新版本；只改提示词、模型或 Key 不重写已有摘要。
      // 不设置全局自动过期；请在 Upstash 关闭 Eviction，并安排数据库备份。
      revisions: {},
      // 文风提示词，最多 16000 字符。生成器另行约束事实、JSON 格式及长度。
      // 新摘要使用当前提示词；已保存摘要不因提示词编辑而自动改变。
      // 不在此文件填写 API Key、Redis Token 或其他秘密。
      prompt: `根据当前文章写一段自然的摘要，像作者自己在概括。
先从原文真实的动机、不方便或限制切入，再接上采取的做法。
像把博客前言压缩成两句话，有一点转折和个人味道；没有明确动机时不要编造。
不固定使用“本文介绍”“记录如何”“博主于是”等开头，不复述完整标题或站名。
可以自然使用原文已有的第一人称、措辞和连接词，不强塞口头禅、emoji或营销词。
只保留核心主题和一两个有辨识度的细节，不逐项罗列工具数量、权限、部署及测试。
不编造作者经历、情绪、功能或结果，不把他人或官方项目写成作者原创。
不省略会改变含义的关键前提，例如“本地电脑无需常开”不等于“不需要常驻服务器”。
技术文概括动机与做法；生活、随笔概括事件与感受，不强行包装成教程。
建议80至130个字符，使用一至两句完整的话；中英文之间合理留空格。`,
    },
  },
}
