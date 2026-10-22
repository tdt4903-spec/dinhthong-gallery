#!/usr/bin/env node

// For git-triggered deployments, wait for this exact commit to reach production
// before pruning either provider. A failed or unrelated deployment never prunes.
import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const commit = process.argv[2] || spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim()
if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error('A full Git commit SHA is required')
let token = process.env.VERCEL_TOKEN
if (!token) {
  const auth = spawnSync('npx', ['--yes', 'vercel@65.0.0', 'whoami'], {
    encoding: 'utf8', stdio: 'pipe', timeout: 90_000, env: { ...process.env, CI: 'true' },
  })
  if (auth.status !== 0) throw new Error('Refresh Vercel CLI authentication before deployment cleanup')
  const path = process.platform === 'darwin'
    ? join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json')
    : join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'com.vercel.cli/auth.json')
  token = JSON.parse(await readFile(path, 'utf8')).token
}
if (!token) throw new Error('Vercel authentication unavailable')

console.log(`Waiting for ${commit.slice(0, 7)} to reach Vercel production.`)
const deadline = Date.now() + 15 * 60_000
let succeeded = false
while (Date.now() < deadline) {
  const response = await fetch('https://api.vercel.com/v9/projects/prj_F5BrKtRoTXRP5ro7L9zcMeeHOKY7?teamId=team_4m3ENYOFiEFirnKjTcA4h4Yx', {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Unable to inspect Vercel production (HTTP ${response.status})`)
  const project = await response.json()
  const production = project.targets?.production
  if (production?.meta?.githubCommitSha === commit && production.readyState === 'READY') {
    succeeded = true
    break
  }
  await new Promise(resolve => setTimeout(resolve, 15_000))
}
if (!succeeded) throw new Error('This commit did not reach production; no deployments were removed')
console.log('Requested commit is Ready in production; applying deployment retention.')
const cleanup = spawnSync(process.execPath, [join(root, 'scripts/prune-deployments.mjs'), '--apply', '--local-auth'], {
  cwd: root, stdio: 'inherit', env: process.env,
})
process.exitCode = cleanup.status ?? 1
