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

  // 可选 SEO 优化功能：构建时为每篇已发布文章生成独立的 AI description，
  // 用于页面摘要元数据和 BlogPosting 结构化数据，不修改文章内容。
  // AI 摘要持久保存在 Upstash，已有同内容摘要直接复用，访客读取页面不调用模型。
  // API 地址、Key、模型和 Redis 凭据在部署环境变量中配置，参见 .env.example。
  ai_desc_gen: {
    // 摘要模式，默认 'auto'。可选：
    // 'auto'：有 OPENAI_API_KEY 时使用 AI，没有时正常使用正文摘录。
    // 'ai'：要求 AI；缺少必要的接入配置时停止构建。
    // 'extractive'：仅使用正文摘录，不读取 AI 摘要记录、不调用模型。
    // auto 启用 AI 后与 ai 使用相同故障策略，不会自行切回摘录模式。
    mode: 'auto',
    // AI 调用失败策略，默认 'fail-build'。可选：
    // 'fail-build'：停止本次构建，不发布这个版本。
    // 'fallback-extractive'：仅失败文章使用正文摘录，明确警告后继续构建。
    // 超时、限流、上游 HTTP 错误（包括鉴权/模型错误）和不合格输出均适用。
    // 摘录不保存为 AI 记录，下次构建仍可重试；已保存的有效摘要保持原样。
    // 非法本地配置、数据库故障或保存失败始终停止构建。
    onAIError: 'fail-build',
    // 新生成摘要字符上限，整数 20～160，默认 160，包含英文、空格和标点。
    // 这是项目的输出上限，不是搜索引擎规定的最佳长度或完整展示保证。
    // 输出过长会校验失败；已保存摘要不因本值变化而截断或重新生成。
    maxLength: 160,
    // 每次构建最多尝试生成的文章数，整数 1～500，默认 200。
    // 读取已有摘要不计入；超出上限按 onAIError 停止或使用摘录并报告数量。
    maxGenerationsPerBuild: 200,
    // 单次 AI 请求超时，整数 1000～120000 毫秒，默认 60000。
    timeoutMs: 60000,
    // 网络、429、5xx 错误的额外重试次数，整数 0～3，默认 2。
    // 2 表示最多请求 3 次；其他 HTTP 错误不重试，直接执行 onAIError。
    maxRetries: 2,
    // 文风提示词，最多 16000 字符。生成器另行保证事实边界、格式及长度约束。
    // 仅新生成摘要使用当前提示词，已有同内容摘要保持不变。
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
}
