/**
 * Score Clear sticks across devices via Room Generation (ADR-0005).
 * Seam: window.Malchishnik.query + Playwright multi-context (+ Firebase room).
 *
 * Proves: Clear on A → zeros + empty night log on B live; refresh A+B still cleared;
 * Players kept; roomGeneration exposed and bumped.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import {
  chromePath,
  ensurePlayers,
  gameQuery,
  resetGame,
  roomUrl,
  waitForGame,
} from './qa-lib.mjs'

const BASE = process.env.QA_URL || process.env.BASE || 'https://zovminga.github.io/malchishnik-spin/'
const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa-score-clear'
fs.mkdirSync(OUT, { recursive: true })

const report = []
function log(step, ok, detail) {
  const line = `${ok ? 'PASS' : 'FAIL'} | ${step}${detail != null && detail !== '' ? ' — ' + detail : ''}`
  report.push(line)
  console.log(line)
  return ok
}

function roomIdFromUrl(url) {
  try {
    return new URL(url).searchParams.get('room') || ''
  } catch {
    return ''
  }
}

async function putState(room, obj) {
  const res = await fetch(`${DB}/rooms/${room}/state.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
  if (!res.ok) throw new Error('PUT failed ' + res.status)
}

async function newPage(browser) {
  const page = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage()
  page.on('dialog', async (d) => {
    await d.accept()
  })
  return page
}

function scoresCleared(q) {
  const scores = q.scores || []
  return scores.length >= 2 && scores.every((p) => Number(p.score) === 0)
}

function historyEmpty(q) {
  return !q.history || q.history.length === 0
}

async function waitCleared(page, minGen, timeout = 20000) {
  await page.waitForFunction(
    (gen) => {
      const q = window.Malchishnik.query()
      const scores = q.scores || []
      const zeros = scores.length >= 2 && scores.every((p) => Number(p.score) === 0)
      const emptyLog = !q.history || q.history.length === 0
      const genOk = typeof q.roomGeneration === 'number' && q.roomGeneration >= gen
      return zeros && emptyLog && !q.roundOpen && genOk
    },
    minGen,
    { timeout },
  )
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath(),
    args: ['--disable-dev-shm-usage'],
  })
  const pageA = await newPage(browser)
  const pageB = await newPage(browser)

  const url = roomUrl(BASE, 'qa-score-clear-' + Date.now())
  const room = roomIdFromUrl(url)
  console.log('url', url)

  // Seed Night Progress so Score Clear must thin the Room (the wipe MergePolicy used to reject).
  await putState(room, {
    players: [
      { name: 'Azat', score: 5 },
      { name: 'Alexander', score: 3 },
    ],
    activePlayer: 0,
    round: null,
    history: [{ who: 'Azat', place: 'БАР', note: 'выполнил (+2)', color: '#1a6bff' }],
    destinations: [
      { id: 'bar', label: 'БАР', tagline: 'x', color: '#1a6bff', text: '#fff' },
      { id: 'casino', label: 'КАЗИНО', tagline: 'y', color: '#ff003c', text: '#fff' },
    ],
    challenges: { bar: ['тест'], casino: [] },
    roomGeneration: 0,
    updatedAt: Date.now(),
    updatedBy: 'seed',
  })

  await Promise.all([
    pageA.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
    pageB.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
  ])
  await Promise.all([waitForGame(pageA), waitForGame(pageB)])

  await pageA.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      return (q.scores || []).some((p) => p.name === 'Azat' && Number(p.score) === 5)
    },
    null,
    { timeout: 20000 },
  )
  await pageB.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      return (q.scores || []).some((p) => p.name === 'Azat' && Number(p.score) === 5)
    },
    null,
    { timeout: 20000 },
  )

  let qA = await gameQuery(pageA)
  const buildOk = log('build present', /build\s+\d+/i.test(qA.build || ''), qA.build)
  const genFieldOk = log(
    'Malchishnik.query exposes roomGeneration',
    typeof qA.roomGeneration === 'number',
    String(qA.roomGeneration),
  )
  const genBefore = Number(qA.roomGeneration) || 0

  const btnCount = await pageA.locator('#scoreClearBtn').count()
  log('Score Clear control #scoreClearBtn exists', btnCount === 1, `count=${btnCount}`)

  await resetGame(pageA)

  let peerOk = false
  try {
    await waitCleared(pageB, genBefore + 1)
    peerOk = true
  } catch (e) {
    peerOk = false
  }
  const qBLive = await gameQuery(pageB)
  log(
    'Peer B sees zeros + empty log live after Score Clear on A',
    peerOk && scoresCleared(qBLive) && historyEmpty(qBLive) && !qBLive.roundOpen,
    `gen=${qBLive.roomGeneration} scores=${(qBLive.scores || []).map((p) => p.name + ':' + p.score).join(',')} hist=${(qBLive.history || []).length}`,
  )
  log(
    'Players kept on B after Score Clear',
    (qBLive.scores || []).map((p) => p.name).join(',') === 'Azat,Alexander',
    (qBLive.scores || []).map((p) => p.name).join(','),
  )
  log(
    'Room Generation bumped on B',
    Number(qBLive.roomGeneration) > genBefore,
    `${genBefore} -> ${qBLive.roomGeneration}`,
  )

  // Refresh both phones — cleared Room must stick (not resurrect Night Progress).
  await Promise.all([pageA.reload({ waitUntil: 'domcontentloaded' }), pageB.reload({ waitUntil: 'domcontentloaded' })])
  await Promise.all([waitForGame(pageA), waitForGame(pageB)])
  await waitCleared(pageA, genBefore + 1)
  await waitCleared(pageB, genBefore + 1)
  qA = await gameQuery(pageA)
  const qB = await gameQuery(pageB)
  const refreshOk = log(
    'Refresh A+B still cleared',
    scoresCleared(qA) &&
      scoresCleared(qB) &&
      historyEmpty(qA) &&
      historyEmpty(qB) &&
      Number(qA.roomGeneration) > genBefore &&
      Number(qB.roomGeneration) > genBefore,
    `A gen=${qA.roomGeneration} B gen=${qB.roomGeneration}`,
  )

  // Empty-join regression smoke: same Room Generation must not wipe a live party.
  // (Full suite is test:wipe; here we only ensure helpers still leave a coherent Room.)
  await ensurePlayers(pageA, ['Azat', 'Alexander'])
  const qAfter = await gameQuery(pageA)
  log(
    'Players still present after clear helpers',
    (qAfter.scores || []).length >= 2,
    String((qAfter.scores || []).length),
  )

  await fetch(`${DB}/rooms/${room}/state.json`, { method: 'DELETE' }).catch(() => {})
  fs.writeFileSync(`${OUT}/report.txt`, report.join('\n') + '\n')
  await browser.close()

  const ok =
    buildOk &&
    genFieldOk &&
    btnCount === 1 &&
    peerOk &&
    refreshOk &&
    Number(qBLive.roomGeneration) > genBefore
  console.log(ok ? 'SCORE CLEAR QA GREEN' : 'SCORE CLEAR QA RED')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
