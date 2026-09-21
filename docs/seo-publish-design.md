# GitHub-owned SEO publishing: proposed replacement

Status: DESIGN ONLY, not enabled. The existing description push workflow is an earlier candidate, not this design. Do not merge/enable it for bulk generation until the prompt and release flow are approved. Production settings, Vercel configuration, article files and the production AI cache are unchanged by this design document.

## One production owner

Author/editor/API -> remote main commit S -> one GitHub publish workflow -> matching AI descriptions -> validate -> vercel build -> deploy prebuilt candidate -> smoke test -> promote.

GitHub owns orchestration, AI calls, validation and build. Vercel hosts the completed output and serves runtime functions; it neither receives the AI key nor independently races to build the original article commit. After the replacement pipeline is tested, disable native Git auto-deployments for production and any SEO/cache branches. Vercel supports git.deploymentEnabled and its official CLI prebuilt workflow. Do not disable current deployment before the replacement is ready.

## Minimal persistent state

Keep the existing src/generated/seo-descriptions.json sidecar in this repository; never write posts/**/*.mdx, even frontmatter. The same workflow may save only this JSON with GITHUB_TOKEN, using a fast-forward update based on S. That yields a derived commit S1, containing exactly S plus the cache update. Continue building and deploying S1 IN THE SAME WORKFLOW; never wait for its push to trigger a second job. No new database, cache branch or runtime AI service is needed for this blog.

Cache entries record source hash, approved prompt/input-cleaner version, requested model/configuration identity, description and generation time. Only missing/stale entries are generated. These metadata timestamps must not affect sitemap lastmod or BlogPosting dateModified. Persist successful entries even if a later request fails; do not deploy partial/unvalidated results. A file-level cache commit must not silently attach itself to a newer source tree. Never force-push. On a concurrent main update preserve the result artifact and reconcile the latest source explicitly.

Bind every release to source SHA, metadata SHA/hash and build artifact identity. The candidate is built from the pinned tree with its exact generated JSON. Do not fetch latest main halfway through a build or run a generic Deploy Hook that happens to build another ref. Artifacts preserve the exact release metadata for diagnosis and rollback. actions/cache is only an optimization, not the sole authoritative metadata store.

## Trigger contract

- main push from local SSH/HTTPS, GitHub UI, PAT-authenticated editor or a suitable GitHub App enters the normal push trigger (subject to GitHub permissions and skip/branch filters).
- A publishing workflow that writes articles with the special Actions-provided GITHUB_TOKEN must explicitly dispatch the same publishing workflow or call its reusable entrypoint. An environment variable called GITHUB_TOKEN containing a PAT is not the special token.
- Provide workflow_dispatch for manual recovery. A low-frequency reconciliation trigger can compare current main with the last successful production release and enter the same workflow if they differ; this covers missed/suppressed pushes but is not instantaneous and is subject to Actions schedule delays.
- Never interpret actor name, email, commit author or an arbitrary 'bot' label as permission to skip validation. Ignore already successful release identities rather than all bot commits.
- Checks on untrusted PRs get neither the AI key nor deployment credentials. No pull_request_target execution of untrusted head code.

## Failure and concurrency policy

Before paid calls, run local tests and validate config. Use bounded retry and a per-run cap. No change means no AI request. Initial backfill is a separately controlled first invocation of the same generator, not a periodic all-site rewrite.

For production, absent/stale descriptions for the target published articles block release after limited retries. Preserve the existing live deployment; mechanical excerpts remain available for development/explicitly approved degraded releases, not silently counted as AI success. An AI outage must not modify the existing production site.

Use a single serialized production publish/promote section, no force pushes, and recheck the intended source before promotion. Cancel/skip superseded builds where safe, but do not claim GitHub cancellation revokes an already submitted Vercel operation. A SHA check is not an atomic transaction spanning GitHub and Vercel. Candidates should be uploaded without assigning production domains, smoke-tested, then promoted under the publish lock. Older candidates must never be promoted after a newer release. Record source SHA and deployment URL. Rollback reuses a previous immutable deployment rather than re-generating AI text.

Smoke tests should include HTTP status, article body presence, title suffix exactly once, expected description, JSON-LD context/type, accurate dates and canonical URLs. Do not promise to repair the pre-existing missing-article 500 through metadata changes.

## Configuration

GitHub Secrets: OPENAI_API_KEY (existing), optionally OPENAI_BASE_URL (existing), VERCEL_TOKEN (project/team-appropriate scope). Repository Variables: OPENAI_MODEL=gpt-5.6-luna (existing), VERCEL_ORG_ID, VERCEL_PROJECT_ID. The Vercel identifiers are not passwords. Tokens are step/job-scoped; no AI key in NEXT_PUBLIC_*, logs, artifacts or Vercel runtime/build settings. Keep ordinary app build/runtime environment variables where currently managed and retrieve needed Vercel build settings through vercel pull, without logging them.

Pin the CLI/actions, record versions, and verify Next.js build-time environment assumptions with the real production build; prebuilt deployments may not supply every Vercel system variable automatically. This design is not a claim that the current project already passes that build.

## Adoption order

1. Approve the summary voice/prompt with fresh sample outputs; keep unapproved outputs out of production cache.
2. Implement the replacement publish workflow and remove the old automatic description-only publishing path, retaining a non-publishing evaluation workflow.
3. Configure Vercel credentials in GitHub and build/deploy a non-promoted candidate from the pinned commit. Verify metadata and article-file immutability.
4. Only then switch off independent Git production deployment and enable the sole production publisher. Verify local, editor/PAT and explicit GITHUB_TOKEN dispatch paths.

References: https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel ; https://vercel.com/docs/project-configuration/git-configuration ; https://vercel.com/docs/cli/deploy ; https://vercel.com/docs/deployments/managing-deployments ; https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow
