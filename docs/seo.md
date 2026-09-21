# SEO metadata and optional AI descriptions

## Scope

This change does not edit any `posts/**/*.mdx` file, article title/body/frontmatter, article OG image configuration, outdated-content notice, URL rewrite rules, or the separate URL-submission repository.

It fixes sitemap dates, the WebSite JSON-LD context, article descriptions, BlogPosting JSON-LD, the archive document title, and the document language. Existing article OG image remains `/api/og`; BlogPosting may reference the article's already configured image without changing OG.

## Description flow

```text
Published MDX (read only) -> title + tags + body hash
                        -> matching validated AI cache? -> use cached description
                        -> otherwise -> title + cleaned body excerpt (no API)

Push articles to main / manually run workflow
  -> read published articles (never drafts)
  -> generate missing/changed descriptions using Chat Completions
  -> validate text and checkpoint each success
  -> commit only src/generated/seo-descriptions.json
  -> your existing deployment must build the new commit
```

The initial cache is empty: every article gets an independent extractive description immediately after deploying these changes. This does **not** mean every article has already been summarized by an LLM. AI generation starts only after a key is configured and the workflow runs. Page requests and normal builds never call the API.

AI metadata lives in a sidecar JSON file, not the articles. The source hash includes title, tags and the entire article body; changes to frontmatter dates alone do not spend tokens again. Stale or invalid cached descriptions fall back to the current article excerpt. Changing the model alone does not invalidate existing descriptions; remove selected cache entries to explicitly regenerate them.

## Configure once

In this repository, open **Settings -> Secrets and variables -> Actions**.

| Setting | Where | Value |
| --- | --- | --- |
| `OPENAI_API_KEY` | Repository secret | Your API key; never commit it or put it in `NEXT_PUBLIC_*` |
| `OPENAI_BASE_URL` | Repository variable or secret | API base including its version path, e.g. `https://api.openai.com/v1` |
| `OPENAI_MODEL` | Repository variable, optional | Defaults to `gpt-5.4-mini`; custom providers must expose this model or specify their model ID |
| `SEO_MAX_POSTS` | Repository variable, optional | Max attempted articles per push, default 200, allowed 1-500 |

The default endpoint is OpenAI. A custom provider must implement **Chat Completions** and accept `model`, `messages`, and `max_completion_tokens`. A Responses-only endpoint is not compatible with this workflow. The base URL can also end in `/chat/completions`. Only HTTPS is allowed; credentials in the URL, query strings, fragments, and HTTP redirects are rejected.

Then open **Actions -> Generate AI SEO descriptions -> Run workflow**, select `main`. A first validation run with `max_posts=2` is prudent; use 200 for the initial backfill. Thereafter, article pushes automatically process only missing/changed entries. Matching cached articles are skipped. No periodic mass rewriting is scheduled.

Generation sends the published title, tags and up to 12,000 characters of cleaned article text to the selected provider. Code blocks and images are not uploaded. Choose a provider you trust. Requests have a 60-second timeout, up to three attempts for network/429/5xx failures, and a 2,048-output-token limit per request. Authentication and other non-retryable 4xx failures stop the batch. API usage is billed by that provider, separately from ChatGPT subscriptions.

The model returns only a short JSON description; it has no repository tools and cannot edit articles. Descriptions must be 20-160 Unicode characters, a single paragraph, and contain no HTML, URL or code fence. Mechanical validation is not a factual or SEO-quality guarantee; review the initial sample.

The workflow uses the repository's built-in `GITHUB_TOKEN`, with no personal token required. Its write step calls the Contents API for **only** `src/generated/seo-descriptions.json`; it never force-pushes. Branch protection or repository policies can reject this commit, in which case the generated artifact is retained and the job fails rather than bypassing protection.

Successful entries are saved even when later API calls fail; the workflow still ends in failure to surface the problem. Rerunning resumes from matching hashes. No key means a clear skipped-generation message, no API calls, and ordinary extractive descriptions.

A cache commit is not proof of a production deployment. This PR intentionally does not change the existing hosting/deployment integration. In particular, pushes created with `GITHUB_TOKEN` do not trigger another GitHub Actions `push` workflow; an Actions-based deployment must be explicitly chained. See [GitHub's workflow-trigger documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow). Verify the hosting platform actually builds the new metadata commit.

## Dates and structured data

Article `lastmod` / `dateModified` use valid `updatedOn`, falling back to `date`, and cannot precede publication. Invalid/missing dates are omitted; never substitute execution time. Static sitemap entries omit `lastmod` because there is no authoritative content timestamp. The AI cache's `generatedAt` never affects article dates.

`WebSite` and `BlogPosting` use `https://schema.org`. BlogPosting identifies the existing canonical `.html` URL, title, description, configured author, language, dates and valid existing image. JSON is escaped before embedding in a script element. Markup helps describe pages; it does not guarantee indexing, ranking or rich results.

## Tests

```bash
npm ci --ignore-scripts --no-audit --no-fund
node --test scripts/seo.test.mjs
node scripts/generate-seo-descriptions.mjs --dry-run
npx tsc --noEmit
```

The tests cover deterministic hashes, extractive descriptions, timestamps, JSON-LD escaping, API response validation, key-safe errors and bounded retry behavior. The dry run checks fallback coverage for all published MDX files without API calls or file writes.

## Live URL audit: baseline before this change

[Read-only audit run](https://github.com/fx-k/keke.su/actions/runs/35554513251), observed 2026-09-21 02:32 UTC from a GitHub-hosted runner:

| Request | Observed result |
| --- | --- |
| `http://keke.su/` | 308 -> `https://keke.su/` -> 200 |
| `https://www.keke.su/` | 308 -> `https://keke.su/` -> 200 |
| `http://www.keke.su/` | Two 308 hops (HTTPS then apex) -> 200 |
| `/posts/` | 308 -> `/posts` -> 200 |
| `/posts/2026-09-20-new-1.html` | 200, self-referencing canonical |
| `/posts/2026-09-20-new-1` | 200, canonical points to `.html`, no redirect |
| Same `.html` URL with `utm_source` | 200, canonical excludes query |
| `/posts/2026-09-15-new-1.html` | 200, self-referencing canonical |
| `/posts/__seo-audit-missing-20260921.html` | 500, not 404; follow-up issue, not changed here |
| `/robots.txt` | 200, allows crawling and declares sitemap |
| `/sitemap.xml` | 200, 126 URLs including both latest articles; sampled old/new lastmods all matched generation time |

HTTP/HTTPS, www/apex, and archive trailing-slash redirects are already present. Two article URL variants return 200 but consistently nominate `.html` as canonical. This is not proof of duplicate indexing: canonical is a signal, and the selected canonical requires Search Console inspection to confirm. URL rules remain untouched. The sampled missing-article 500 needs separate investigation.
