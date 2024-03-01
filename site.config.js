module.exports = {
  name: 'Xiaojun',
  title: 'Xiaojun Zhou',
  description: 'Front-End Developer',
  avatar: '/avatar.jpg',
  logo: '/logo.svg',
  siteUrl: 'https://www.xiaojun.im',
  // icon 请在 src/components/Splash.tsx 中修改
  links: [
    { name: 'GitHub', link: 'https://github.com/xiaojundebug' },
    { name: 'X', link: 'https://twitter.com/xiaojundebug' },
    { name: '稀土掘金', link: 'https://juejin.cn/user/3386151543772328' },
    { name: 'RSS', link: '/feed.xml' },
  ],
  friends: [
    { name: '赖同学', link: 'https://www.laibh.com' },
    { name: '鯊手', link: 'https://www.cnblogs.com/Scooby' },
    { name: '戴兜', link: 'https://im.daidr.me' },
    { name: 'lufangzhou', link: 'https://zhoufanglu.github.io/vuepressBlog' },
  ],
  // en | zh-CN
  language: 'en',
  // 侧边目录
  toc: true,
  // 显示上一篇下一篇按钮
  adjacentPosts: true,
  // 配置文章过时提醒阈值
  outdatedPostThresholdDays: 90,
  markdown: {
    // 统一配置 CodeBlock 是否显示行号，也可以在 frontmatter 中通过 lineNumbers 字段单独设置
    lineNumbers: false,
  },
}
