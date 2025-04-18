# keke.su

[English](./README.en.md) • [中文](./README.md)

小可の聚集地, built with Next.js, TypeScript, MDX, and TailwindCSS.

👀 [Online Preview](https://keke.su/)

![GitHub last commit](https://img.shields.io/github/last-commit/fx-k/keke.su)  ![Vercel Deploy](https://deploy-badge.vercel.app/vercel/192168123-xyz)

## Features

- 🎨 Simple, smooth, fast, one-click dark mode
- ✨ Responsive design, theme color configuration, CI/CD deployment
- 🧩 Built-in Markdown extended syntax, thanks to MDX, supports embedding JSX components in articles
- 🎮 Built-in CodePlayground, allowing code blocks to be run directly in articles (beta)
- 🔫 Fun like button, visit counter, and sound effects
- 😎 Profile with typewriter effect, supports multiple carousel displays, and custom personal slogans~
- 👐 Automatic friend link icon display, better friend link management logic (easier to remove broken links)
- 💭 Supports self-deployed Artalk comment system (avoiding third-party comment ads/shutdowns)

## Deployment

### Local Deployment

Before deployment, please ensure the following environment is properly configured locally:

- Node.js (e.g., v20.15.0)
- git (e.g., 2.45.2)

Let's start:

1. Find a directory and clone this repository. `git clone https://github.com/fx-k/keke.su.git`
2. Enter the directory and install dependencies. `npm install`
3. Customize your site in the `site.config.js` file.
4. To use the like button and visit counter, register for the [Upstash Redis](https://console.upstash.com/redis) service (free plan available), then create a `.env` file in the root directory with the following content:
   ```bash
   UPSTASH_REDIS_REST_URL = your_own_info
   UPSTASH_REDIS_REST_TOKEN = your_own_info
   ```
5. To use the comment service, deploy the Artalk comment service. Refer to the official [guide](https://artalk.js.org/guide/deploy.html). Then, modify the `artalkServer` field in the `site.config.js` file to point to your deployed server.
6. To automatically fetch and display friend link icons, deploy an API to fetch website favicons. Then, modify the `getFaviconAPI` field in the `site.config.js` file to point to your deployed server.
7. In order to implement website statistics service, you need to deploy the **Umami** service by yourself. Then, in the `.env` file, add the following information:
   ```bash
   NEXT_PUBLIC_ANALYTICS_SRC = your_own_info
   NEXT_PUBLIC_ANALYTICS_ID = your_own_info
   ```
8. Run `npm run dev` to preview the website.

### Deploy to Vercel or Other Workflows

Of course, you wouldn't just want to deploy locally (even if it's a zero-visitor site haha).

Setting up an automatic deployment workflow is quite easy.

The simplest way is to deploy directly to Vercel, enabling local blog writing👉git push👉website update.

Follow these steps:

1. Click fork on the GitHub page of this project to fork the repository to your GitHub account.
2. Follow the local deployment tutorial, but replace the `git clone` step link with the new repository link generated after you fork the repository (you might need to configure your git account locally first).
3. Register a [Vercel](https://vercel.com/) account and bind your forked repository. The process is simple, refer to the official [guide](https://vercel.com/docs/getting-started-with-vercel). (Remember to configure the `.env` file content as environment variables in Vercel)
4. Bind your own domain in the Vercel backend, or use the domain automatically generated by Vercel.
5. Deployment complete. You can write mdx files locally, then `git push` to your forked repository. Vercel will automatically deploy the content of each commit, updating the website.

## Writing Blogs

### Creating a New Post

Use the `npm run new:post` command to create a new post.

### Deleting a Post

Just delete it...

### Post Fields (Front Matter)

This project automatically recognizes the Front Matter fields in mdx files, generating titles, article covers, writing dates, update dates, etc.

| Field Name | Example                      | Description                                                          |
| ---------- | ---------------------------- | -------------------------------------------------------------------- |
| title      | My New Post                  | Title of the article                                                 |
| date       | 2024-07-18T11:34:53Z         | Creation date of the article                                         |
| tags       | - Announcement<br />- Tech | Tags for the article, starting with `-`, multiple tags             |
| updatedOn  | 2024-07-18T11:38:16Z         | Update date of the article                                           |
| image      | /test.webp                   | Cover image of the article (can be external or in the public folder) |
| draft      | false                        | Whether it is a draft, if true it will not be displayed              |

PS: You can use [Obsidian](https://obsidian.md/) or [VS Code](https://code.visualstudio.com/) plugins to better manage mdx Front Matter.

## Acknowledgements

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
