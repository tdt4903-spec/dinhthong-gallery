<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Deployment retention

The user requires keeping the newest four deployments on Vercel and Cloudflare.
After pushing a web release, run `node scripts/after-vercel-deploy.mjs` and wait
for the exact commit to become Ready in production and for cleanup to finish.
Deploy the Worker with `node scripts/deploy-cloudflare.mjs`, which cleans up
after a successful release. For maintenance, use
`node scripts/prune-deployments.mjs --local-auth --apply`.
Preserve the currently serving production deployment and uploaded media. Report
authentication failures or postponed cleanup accurately; do not claim cleanup
completed from a successful build alone. See `docs/deployment-retention.md`.
