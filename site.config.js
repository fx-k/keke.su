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
  backToTopButton: true
}
