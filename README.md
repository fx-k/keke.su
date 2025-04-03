# keke.su

[English](./README.en.md) • [中文](./README.md)

小可の聚集地，由 Next.js、TypeScript、MDX 和 TailwindCSS 构建。

👀 [在线预览](https://keke.su/)

![GitHub last commit](https://img.shields.io/github/last-commit/fx-k/keke.su)  ![Vercel Deploy](https://deploy-badge.vercel.app/vercel/192168123-xyz)


## 特色

- 🎨 简洁、丝滑、快速、一键暗黑模式
- ✨ 响应式设计、主题色配置、CI/CD部署
- 🧩 内置一些 Markdown 扩展语法，得益于 MDX，还支持在文章中嵌入 JSX 组件
- 🎮 内置 CodePlayground，可以直接在文章中运行代码块（beta）
- 🔫 充满趣味的点赞按钮、访问量计数器、音效反馈
- 😎 Profile使用打字机特效，支持多条轮播展示，专享个人slogan~
- 👐 友链图标自动展示，更好的友链管理逻辑（更方便下架跑路的友链~
- 💭 支持Artalk自部署评论系统（避免第三方评论广告/倒闭

## 部署

### 本地部署

部署前，请确保本地已正确配置以下环境：

- Node.js（以v20.15.0为例）
- git（以2.45.2为例）

那么，开始：

1. 找个目录，git clone本仓库。`git clone https://github.com/fx-k/keke.su.git`
2. 进入目录，安装依赖。`npm install`
3. 你可以在 `site.config.js` 文件中客制化你的网站。
4. 为了使用点赞和访问量统计功能，需要注册 [Upstash Redis](https://console.upstash.com/redis) 服务（可以白嫖免费套餐），然后在根目录下创建 `.env` 文件，填入以下信息：
   ```bash
   UPSTASH_REDIS_REST_URL = 填入自己的信息
   UPSTASH_REDIS_REST_TOKEN = 填入自己的信息
   ```
5. 为了使用评论服务，你需要部署Artalk评论服务，具体部署请参考官方的[guide](https://artalk.js.org/guide/deploy.html)。然后，在 `site.config.js` 文件中修改 `artalkServer` 字段，改成你自己部署的服务器后端。
6. 为了实现友链图标的自动获取与展示，你需要自行部署一个**获取网站favcoin**的API。然后，在 `site.config.js` 文件中修改 `getFaviconAPI` 字段，改成你自己部署的服务器后端。
7. 为了实现网站统计服务，你需要自行部署**Umami**服务。然后， `.env` 文件，加入以下信息：
   ```bash
   NEXT_PUBLIC_ANALYTICS_SRC = 填入自己的信息
   NEXT_PUBLIC_ANALYTICS_ID = 填入自己的信息
   ```
8. 运行 `npm run dev` 即可预览网站效果。

### 部署到Vercel等工作流

当然，你肯定不止满足于部署到本地（即使这只是一个0ip的网站hhh）。

实现自动部署的工作流，其实并不难。

最简单的方法，可以直接部署到Vercel，实现本地写博客👉git push👉网站更新的效果。

跟着以下教程即可：

1. 点击本项目GitHub页面上面的fork，fork本仓库到你的GitHub账号。
2. 参考 `本地部署` 教程流程，但是把 `git clone` 步骤的链接，换成你fork本仓库后，新生成的仓库链接。（你可能需要先正确在本地cli中配置你的git账户）
3. 注册[Vercel](https://vercel.com/)账户，然后将你fork后的仓库进行绑定。方法很简单，可以直接参考官方的[guide](https://vercel.com/docs/getting-started-with-vercel)。（记得要在Vercel里面把你的 `.env` 文件内容配置到环境变量中）
4. 可以在Vercel后台绑定你自己的域名，或者直接使用Vercel自动为你生成的专属域名。
5. 至此，部署完成。你可以在本地写mdx文件，然后 `git push` 到你fork后的仓库，Vercel会自动部署你每次commit后的内容，实现网站更新。

## 写博客

### 新建文章

使用 `npm run new:post` 命令，即可新建文章。

### 删除文章

直接删除即可...

### 文章字段（Front Matter）

本项目会自动识别mdx文件的Front Matter字段，生成标题、文章封面、写作日期、更新日期等。

| 字段名    | 示例                   | 说明                                                 |
| --------- | ---------------------- | ---------------------------------------------------- |
| title     | 我的一篇新文章         | 文章的标题                                           |
| date      | 2024-07-18T11:34:53Z   | 文章的创作日期                                       |
| tags      | - 望周知<br />- 技术向 | 文章的标签，以 `-`开头，可以包含多个               |
| updatedOn | 2024-07-18T11:38:16Z   | 文章的更新日期                                       |
| image     | /test.webp             | 文章的封面图片（可以是外链或者public文件夹下的图片） |
| draft     | false                  | 是否为草稿，若为true则不进行展示                     |

PS: 可以搭配 [Obsidian](https://obsidian.md/) 插件或者 [VS Code](https://code.visualstudio.com/) 插件，更好的帮助你来管理mdx的Front Matter

## 致谢

- https://www.xiaojun.im
- https://zapsplat.com
- https://www.joshwcomeau.com
- https://cali.so
- https://leerob.io
- https://vuepress.vuejs.org
- https://vitepress.dev
- https://docusaurus.io
- https://github.com/iissnan/hexo-theme-next
- https://github.com/nanxiaobei/hugo-paper
- https://github.com/SoloReverse/nextjs-simple-typewriter
- https://artalk.js.org/
