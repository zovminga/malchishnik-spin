/**
 * One-command QA: starts the local server when the target is the local default and
 * nothing answers there, runs the requested suites one after another, prints a summary.
 *
 * Usage:
 *   node scripts/qa-all.mjs            # qa suite
 *   node scripts/qa-all.mjs wipe qa    # npm run qa
 *   QA_URL=https://zovminga.github.io/malchishnik-spin/ node scripts/qa-all.mjs qa   # live Pages
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import { LOCAL_BASE, artifactDir, qaBase } from './qa-lib.mjs'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_WAIT_MS = 10000
const SUITES = {
  wipe: ['repro-score-wipe'],
  qa: [
    'qa-round-owner',
    'qa-scoring-challenge',
    'qa-turn-handoff',
    'qa-malchishnik',
    'qa-dual-spin',
    'qa-dual-award',
    'qa-mid-round-join',
    'qa-groom-salute',
    'qa-groom-salute-peers',
    'qa-control-polish',
    'qa-stuck-open-round',
    'qa-reload-mid-spin',
    'qa-offline',
    'qa-remove-player',
    'qa-remove-player-peers',
    'qa-editor-sync',
    'qa-score-clear',
    'qa-game-restart',
    'qa-reset-matrix',
  ],
}

async function reachable(base) {
  try {
    const res = await fetch(base + 'index.html')
    return res.ok
  } catch (e) {
    return false
  }
}

async function ensureServer(base) {
  if (await reachable(base)) return null
  if (base !== LOCAL_BASE) throw new Error(`QA target ${base} does not answer`)
  const server = spawn('python3', ['-m', 'http.server', '8765', '--bind', '127.0.0.1'], {
    cwd: REPO_ROOT,
    stdio: 'ignore',
  })
  const start = Date.now()
  while (Date.now() - start < SERVER_WAIT_MS) {
    if (await reachable(base)) return server
    await new Promise((r) => setTimeout(r, 200))
  }
  server.kill()
  throw new Error('local server did not start on ' + base)
}

function runScript(script, base) {
  const out = process.env.QA_OUT ? path.join(process.env.QA_OUT, script) : artifactDir(script)
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join('scripts', script + '.mjs')], {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      env: { ...process.env, QA_URL: base, BASE: base, QA_OUT: out },
    })
    child.on('exit', (code) => resolve(code == null ? 1 : code))
  })
}

async function main() {
  const names = process.argv.slice(2)
  const suites = names.length ? names : ['qa']
  for (const name of suites) {
    if (!SUITES[name]) throw new Error(`unknown suite "${name}" (known: ${Object.keys(SUITES).join(', ')})`)
  }
  const base = qaBase()
  const server = await ensureServer(base)
  process.on('SIGINT', () => {
    if (server) server.kill()
    process.exit(130)
  })
  console.log(`QA target ${base}${server ? ' (local server started)' : ''}`)

  const results = []
  for (const script of suites.flatMap((name) => SUITES[name])) {
    console.log(`\n===== ${script}`)
    const started = Date.now()
    const code = await runScript(script, base)
    results.push({ script, code, seconds: Math.round((Date.now() - started) / 1000) })
  }
  if (server) server.kill()

  console.log('\n===== summary')
  for (const r of results) {
    console.log(`${r.code === 0 ? 'PASS' : 'FAIL'} | ${r.script} (exit ${r.code}, ${r.seconds}s)`)
  }
  const failed = results.filter((r) => r.code !== 0).length
  console.log(failed ? `FAILED ${failed} of ${results.length}` : `ALL GREEN (${results.length} scripts)`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
