#!/usr/bin/env node

// Keep deployment history bounded without touching projects, domains, Worker
// versions, uploaded media, or the deployment currently serving production.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const KEEP = 4
const VERCEL_PROJECT = 'prj_F5BrKtRoTXRP5ro7L9zcMeeHOKY7'
const VERCEL_TEAM = 'team_4m3ENYOFiEFirnKjTcA4h4Yx'
const CLOUDFLARE_ACCOUNT = 'e7e1bf75303f22826bdb5d31b070f5b4'
const CLOUDFLARE_WORKER = 'dinhthong-video-proxy'
const options = new Set(process.argv.slice(2))
const allowed = new Set(['--apply', '--local-auth', '--vercel', '--cloudflare'])
for (const option of options) {
  if (!allowed.has(option)) throw new Error(`Unknown option: ${option}`)
}
const apply = options.has('--apply')
const providers = options.has('--vercel') || options.has('--cloudflare')
  ? ['vercel', 'cloudflare'].filter(provider => options.has(`--${provider}`))
  : ['vercel', 'cloudflare']

async function credentials(provider) {
  const environmentToken = process.env[provider === 'vercel' ? 'VERCEL_TOKEN' : 'CLOUDFLARE_API_TOKEN']
  if (environmentToken) return environmentToken
  if (!options.has('--local-auth')) throw new Error(`Missing ${provider} API token`)

  // Refresh through the vendor CLI; never copy rotating OAuth credentials to CI.
  const command = provider === 'vercel' ? 'vercel@65.0.0' : 'wrangler@4'
  const refreshed = spawnSync('npx', ['--yes', command, 'whoami'], {
    encoding: 'utf8', stdio: 'pipe', timeout: 90_000,
    env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
  })
  if (refreshed.status !== 0) throw new Error(`Refresh ${provider} CLI authentication before cleanup`)
  if (provider === 'vercel') {
    const path = process.platform === 'darwin'
      ? join(homedir(), 'Library/Application Support/com.vercel.cli/auth.json')
      : join(process.env.XDG_DATA_HOME || join(homedir(), '.local/share'), 'com.vercel.cli/auth.json')
    const auth = JSON.parse(await readFile(path, 'utf8'))
    if (!auth.token) throw new Error('Vercel CLI token unavailable')
    return auth.token
  }
  const path = process.platform === 'darwin'
    ? join(homedir(), 'Library/Preferences/.wrangler/config/default.toml')
    : join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), '.wrangler/config/default.toml')
  const auth = await readFile(path, 'utf8')
  const token = auth.match(/^oauth_token\s*=\s*"([^"\r\n]+)"/m)?.[1]
  if (!token) throw new Error('Wrangler CLI token unavailable')
  return token
}

async function request(base, path, token, method = 'GET') {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    })
    if (response.status === 429 && attempt < 3) {
      const retry = Number(response.headers.get('retry-after'))
      await new Promise(resolve => setTimeout(resolve, Math.min(30, retry || 2 ** attempt) * 1000))
      continue
    }
    if (method === 'DELETE' && response.status === 404) return null
    if (!response.ok) throw new Error(`${new URL(base).host}: ${method} failed (HTTP ${response.status})`)
    if (response.status === 204) return null
    const data = await response.json()
    if (data.success === false || data.error) throw new Error(`${new URL(base).host}: API rejected ${method}`)
    return data
  }
  throw new Error('API retry limit reached')
}

function sortedUnique(items, idKey, dateKey) {
  const byId = new Map()
  for (const item of items) {
    if (!item[idKey] || !Number.isFinite(new Date(item[dateKey]).getTime())) {
      throw new Error('Incomplete deployment metadata; refusing cleanup')
    }
    byId.set(item[idKey], item)
  }
  return [...byId.values()].sort((a, b) =>
    new Date(b[dateKey]).getTime() - new Date(a[dateKey]).getTime() || String(b[idKey]).localeCompare(String(a[idKey])))
}

async function vercel(token) {
  const api = (path, method) => request('https://api.vercel.com', path, token, method)
  const scope = `teamId=${VERCEL_TEAM}`
  const getProject = async () => {
    const project = await api(`/v9/projects/${VERCEL_PROJECT}?${scope}`)
    if (project.id !== VERCEL_PROJECT) throw new Error('Unexpected Vercel project')
    return project
  }
  const getDeployments = async () => {
    const all = []
    const seenCursors = new Set()
    let until = ''
    for (let page = 0; page < 1000; page++) {
      const result = await api(`/v6/deployments?projectId=${VERCEL_PROJECT}&${scope}&limit=100${until ? `&until=${until}` : ''}`)
      if (!Array.isArray(result.deployments)) throw new Error('Invalid Vercel deployment list')
      all.push(...result.deployments)
      const next = result.pagination?.next
      if (next == null) return sortedUnique(all, 'uid', 'created')
      if (!result.deployments.length || seenCursors.has(next)) throw new Error('Vercel pagination did not advance')
      seenCursors.add(next)
      until = String(next)
    }
    throw new Error('Vercel pagination limit reached')
  }
  const snapshot = async () => {
    const project = await getProject()
    const deployments = await getDeployments()
    const production = project.targets?.production
    if (!production?.id || production.readyState !== 'READY') throw new Error('Vercel production is not Ready; cleanup postponed')
    if (!deployments.length || (deployments[0].state || deployments[0].readyState) !== 'READY') {
      throw new Error('The newest Vercel deployment did not succeed; cleanup postponed')
    }
    if (deployments.some(item => ['BUILDING', 'QUEUED', 'INITIALIZING'].includes(item.state || item.readyState))) {
      throw new Error('A Vercel deployment is in progress; cleanup postponed')
    }
    const protectedIds = new Set([
      ...deployments.slice(0, KEEP).map(item => item.uid),
      ...Object.values(project.targets || {}).map(target => target?.id).filter(Boolean),
    ])
    return { deployments, protectedIds, productionId: production.id }
  }

  for (let pass = 1; pass <= 3; pass++) {
    const before = await snapshot()
    const candidates = before.deployments.filter(item => !before.protectedIds.has(item.uid))
    console.log(`Vercel: pass ${pass}, ${before.deployments.length} deployments; ${candidates.length} older deployments ${apply ? 'to remove' : 'would be removed'}.`)
    if (!apply) return
    for (const candidate of candidates.reverse()) {
      // Re-read before every mutation so concurrent deploys/promotions are protected.
      const fresh = await snapshot()
      if (fresh.protectedIds.has(candidate.uid)) continue
      const detail = await api(`/v13/deployments/${candidate.uid}?${scope}`)
      if (detail.projectId !== VERCEL_PROJECT) throw new Error('Deployment does not belong to the expected Vercel project')
      const projectNow = await getProject()
      if (Object.values(projectNow.targets || {}).some(target => target?.id === candidate.uid)) continue
      await api(`/v13/deployments/${candidate.uid}?${scope}`, 'DELETE')
      console.log(`Vercel: removed ${candidate.uid}.`)
    }
    const after = await snapshot()
    if (!after.deployments.some(item => item.uid === after.productionId)) throw new Error('Could not verify Vercel production after cleanup')
    const remainingCandidates = after.deployments.filter(item => !after.protectedIds.has(item.uid))
    if (!remainingCandidates.length) {
      const protectedExtras = Math.max(0, after.deployments.length - KEEP)
      console.log(`Vercel: verified ${after.deployments.length} deployments remain; production preserved.${protectedExtras ? ` ${protectedExtras} older live target(s) are additionally protected.` : ''}`)
      return
    }
    if (pass === 3) throw new Error(`Vercel retention did not converge: ${remainingCandidates.length} unprotected older deployment(s) remain; retry cleanup after deployments settle`)
    console.log('Vercel: deployment history changed during cleanup; refreshing the deletion plan.')
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}

async function cloudflare(token) {
  const basePath = `/accounts/${CLOUDFLARE_ACCOUNT}/workers/scripts/${CLOUDFLARE_WORKER}/deployments`
  const api = (path, method) => request('https://api.cloudflare.com/client/v4', path, token, method)
  const snapshot = async () => {
    const all = []
    const seenIds = new Set()
    let activeId
    for (let page = 1; page <= 1000; page++) {
      const result = await api(`${basePath}?per_page=100&page=${page}`)
      const items = result.result?.deployments
      if (!Array.isArray(items)) throw new Error('Invalid Cloudflare deployment list')
      if (page === 1) activeId = items[0]?.id
      if (items.length && items.every(item => seenIds.has(item.id))) throw new Error('Cloudflare pagination did not advance')
      for (const item of items) seenIds.add(item.id)
      all.push(...items)
      const info = result.result_info
      if (info?.total_pages ? page >= info.total_pages : items.length < 100) {
        const deployments = sortedUnique(all, 'id', 'created_on')
        if (!activeId || !deployments.some(item => item.id === activeId)) throw new Error('Cloudflare active deployment unavailable')
        if (deployments[0].id !== activeId) throw new Error('Unexpected Cloudflare deployment order; refusing cleanup')
        return {
          deployments,
          activeId,
          protectedIds: new Set([activeId, ...deployments.slice(0, KEEP).map(item => item.id)]),
        }
      }
    }
    throw new Error('Cloudflare pagination limit reached')
  }

  for (let pass = 1; pass <= 3; pass++) {
    const before = await snapshot()
    const candidates = before.deployments.filter(item => !before.protectedIds.has(item.id))
    console.log(`Cloudflare: pass ${pass}, ${before.deployments.length} deployments; ${candidates.length} older deployments ${apply ? 'to remove' : 'would be removed'}.`)
    if (!apply) return
    for (const candidate of candidates.reverse()) {
      const fresh = await snapshot()
      if (fresh.protectedIds.has(candidate.id)) continue
      await api(`${basePath}/${candidate.id}`, 'DELETE')
      console.log(`Cloudflare: removed ${candidate.id}.`)
    }
    const after = await snapshot()
    if (!after.deployments.some(item => item.id === before.activeId)) throw new Error('Could not verify Cloudflare active deployment after cleanup')
    const remainingCandidates = after.deployments.filter(item => !after.protectedIds.has(item.id))
    if (!remainingCandidates.length) {
      const protectedExtras = Math.max(0, after.deployments.length - KEEP)
      console.log(`Cloudflare: verified ${after.deployments.length} deployments remain; active deployment preserved.${protectedExtras ? ` ${protectedExtras} older live deployment(s) are additionally protected.` : ''}`)
      return
    }
    if (pass === 3) throw new Error(`Cloudflare retention did not converge: ${remainingCandidates.length} unprotected older deployment(s) remain; retry cleanup after deployments settle`)
    console.log('Cloudflare: deployment history changed during cleanup; refreshing the deletion plan.')
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}

let failed = false
for (const provider of providers) {
  try {
    await (provider === 'vercel' ? vercel : cloudflare)(await credentials(provider))
  } catch (error) {
    failed = true
    // API response bodies and credentials never enter logs.
    console.error(`${provider}: ${error instanceof Error ? error.message : 'Cleanup failed'}`)
  }
}
if (failed) process.exitCode = 1
