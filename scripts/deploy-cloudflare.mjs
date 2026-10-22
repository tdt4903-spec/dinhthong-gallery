#!/usr/bin/env node

// Use this entry point for Worker releases so cleanup follows a successful deploy.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const config = join(root, 'app/workers/video-proxy/wrangler.toml')
const release = spawnSync('npx', ['--yes', 'wrangler@4', 'deploy', '--config', config], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: 'e7e1bf75303f22826bdb5d31b070f5b4', WRANGLER_SEND_METRICS: 'false' },
})
if (release.status !== 0) {
  process.exitCode = release.status ?? 1
} else {
  const cleanup = spawnSync(process.execPath, [join(root, 'scripts/prune-deployments.mjs'), '--apply', '--local-auth'], {
    cwd: root, stdio: 'inherit', env: process.env,
  })
  process.exitCode = cleanup.status ?? 1
}
