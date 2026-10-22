# Deployment retention

Keep the newest four deployments for the `dinhthong-gallery` Vercel project and
the `dinhthong-video-proxy` Cloudflare Worker. The cleanup never deletes a project,
domain, uploaded photo, Worker version, or the deployment currently serving
production. If production was rolled back to an older deployment, that deployment
is protected in addition to the newest four.

## Release commands

After pushing a web release to GitHub:

```sh
node scripts/after-vercel-deploy.mjs
```

This waits up to 15 minutes for the current Git commit to be Ready in Vercel
production, then cleans both providers. To target a different commit, pass its
full 40-character SHA. A release that never reaches production does not clean up.

Deploy the Cloudflare Worker with:

```sh
node scripts/deploy-cloudflare.mjs
```

This runs Wrangler and cleans both providers only after Wrangler reports a
successful release. Run the cleanup again after a Vercel deployment finishes if
one was still building during the Worker release.

## Inspection and manual cleanup

```sh
node scripts/prune-deployments.mjs --local-auth
node scripts/prune-deployments.mjs --local-auth --apply
```

The first command only lists counts. Add `--vercel` or `--cloudflare` to restrict
the cleanup to one provider. Deletion requires `--apply`.

Local authentication refreshes existing vendor CLI sessions and reads their
credentials from the CLI configuration. Tokens are never printed or committed.
For a server runner, provide `VERCEL_TOKEN` and `CLOUDFLARE_API_TOKEN` instead;
rotating local OAuth tokens must not be copied into CI secrets.

The cleanup reads all API pages, checks the current production deployment before
each deletion, and postpones Vercel cleanup while a deployment is building or when
the newest deployment failed. If another deployment arrives during cleanup, it
refreshes the plan for up to three passes. It reports a failure if unprotected old
deployments remain, and explicitly reports any older live targets retained for
safety. API errors stop cleanup for that provider.

## Deployments made outside these commands

The local Codex maintenance automation checks both deployment histories and runs
the same guarded cleanup. It requires this computer's Codex runtime and existing
CLI sessions to remain available. The release commands run cleanup immediately;
the maintenance automation catches manual dashboard deployments afterward.

Vercel's native age-based retention cannot enforce a four-deployment limit because
its built-in exceptions retain a larger minimum history. A server-side event
workflow requires dedicated persistent provider API tokens; local OAuth sessions
are intentionally not repurposed as permanent GitHub credentials.
