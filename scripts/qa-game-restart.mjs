/**
 * Game Restart: Score Clear + remove every Player; Places/Challenges stay (ADR-0005).
 * Seam: window.Malchishnik.query + Playwright multi-context (+ Firebase room).
 *
 * Proves: Restart on A → empty Players on B live; refresh A+B still empty;
 * Places/Challenges preserved; cancel confirm is a no-op; controls near bottom.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import {
  artifactDir,
  chromePath,
  gameQuery,
  gameRestart,
  qaBase,
  roomUrl,
  waitForGame,
} from './qa-lib.mjs'

const BASE = qaBase()
const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const OUT = artifactDir('qa-game-restart')

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

async function getState(room) {
  const res = await fetch(`${DB}/rooms/${room}/state.json`)
  if (!res.ok) throw new Error('GET failed ' + res.status)
  return res.json()
}

async function newPage(browser, dialogMode = 'accept') {
  const page = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage()
  page.on('dialog', async (d) => {
    if (dialogMode === 'accept') await d.accept()
    else await d.dismiss()
  })
  return page
}

async function waitPlayersEmpty(page, minGen, timeout = 20000) {
  await page.waitForFunction(
    (gen) => {
      const q = window.Malchishnik.query()
      const empty = !q.scores || q.scores.length === 0
      const emptyLog = !q.history || q.history.length === 0
      const genOk = typeof q.roomGeneration === 'number' && q.roomGeneration >= gen
      return empty && emptyLog && !q.roundOpen && genOk
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
  const pageA = await newPage(browser, 'accept')
  const pageB = await newPage(browser, 'accept')

  const url = roomUrl(BASE, 'qa-game-restart-' + Date.now())
  const room = roomIdFromUrl(url)
  console.log('url', url)

  const seedPlaces = [
    { id: 'bar', label: 'БАР', tagline: 'x', color: '#1a6bff', text: '#fff' },
    { id: 'casino', label: 'КАЗИНО', tagline: 'y', color: '#ff003c', text: '#fff' },
  ]
  const seedChallenges = { bar: ['тост'], casino: ['ставка'] }

  await putState(room, {
    players: [
      { name: 'Azat', score: 5 },
      { name: 'Alexander', score: 3 },
    ],
    activePlayer: 1,
    round: null,
    history: [{ who: 'Azat', place: 'БАР', note: 'выполнил (+2)', color: '#1a6bff' }],
    destinations: seedPlaces,
    challenges: seedChallenges,
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
    () => (window.Malchishnik.query().scores || []).length >= 2,
    null,
    { timeout: 20000 },
  )
  await pageB.waitForFunction(
    () => (window.Malchishnik.query().scores || []).length >= 2,
    null,
    { timeout: 20000 },
  )

  let qA = await gameQuery(pageA)
  const genBefore = Number(qA.roomGeneration) || 0

  const restartBtn = pageA.locator('#gameRestartBtn')
  const clearBtn = pageA.locator('#scoreClearBtn')
  const hardBtn = pageA.locator('#hardResetBtn')
  const shareBtn = pageA.locator('#shareFriendsBtn')

  const hasRestart = (await restartBtn.count()) === 1
  const hasClear = (await clearBtn.count()) === 1
  const noHard = (await hardBtn.count()) === 0
  const hasShare = (await shareBtn.count()) === 1
  log('Game Restart control #gameRestartBtn exists', hasRestart)
  log('Score Clear control #scoreClearBtn exists', hasClear)
  log('сброс кэша / hardReset removed', noHard)
  log('Copy-link stays top primary', hasShare)

  // Compact controls near the bottom: not in top-actions; below share; smaller than share.
  const layoutOk = await pageA.evaluate(() => {
    const share = document.getElementById('shareFriendsBtn')
    const clear = document.getElementById('scoreClearBtn')
    const restart = document.getElementById('gameRestartBtn')
    const top = document.querySelector('.top-actions')
    if (!share || !clear || !restart) return false
    if (top && (top.contains(clear) || top.contains(restart))) return false
    const s = share.getBoundingClientRect()
    const c = clear.getBoundingClientRect()
    const r = restart.getBoundingClientRect()
    const belowShare = c.top > s.bottom - 2 && r.top > s.bottom - 2
    const compact = clear.offsetHeight <= share.offsetHeight && restart.offsetHeight <= share.offsetHeight
    return belowShare && compact
  })
  log('Score Clear + Game Restart are smaller controls near the bottom', layoutOk)

  // Cancel no-op before the real restart.
  const pageCancel = await newPage(browser, 'dismiss')
  await pageCancel.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(pageCancel)
  await pageCancel.waitForFunction(
    () => (window.Malchishnik.query().scores || []).length >= 2,
    null,
    { timeout: 20000 },
  )
  const beforeCancel = await gameQuery(pageCancel)
  const cancelRestart = pageCancel.locator('#gameRestartBtn')
  await cancelRestart.scrollIntoViewIfNeeded()
  await cancelRestart.click({ force: true })
  await pageCancel.waitForTimeout(400)
  const afterRestartCancel = await gameQuery(pageCancel)
  const cancelRestartOk = log(
    'Cancel Game Restart confirm is a no-op',
    (afterRestartCancel.scores || []).length === (beforeCancel.scores || []).length &&
      Number(afterRestartCancel.roomGeneration) === Number(beforeCancel.roomGeneration) &&
      (afterRestartCancel.history || []).length === (beforeCancel.history || []).length,
    `players=${(afterRestartCancel.scores || []).length} gen=${afterRestartCancel.roomGeneration}`,
  )
  const cancelClear = pageCancel.locator('#scoreClearBtn')
  await cancelClear.scrollIntoViewIfNeeded()
  await cancelClear.click({ force: true })
  await pageCancel.waitForTimeout(400)
  const afterClearCancel = await gameQuery(pageCancel)
  const cancelClearOk = log(
    'Cancel Score Clear confirm is a no-op',
    (afterClearCancel.scores || []).some((p) => Number(p.score) === 5) &&
      Number(afterClearCancel.roomGeneration) === Number(beforeCancel.roomGeneration) &&
      (afterClearCancel.history || []).length === (beforeCancel.history || []).length,
    `gen=${afterClearCancel.roomGeneration} hist=${(afterClearCancel.history || []).length}`,
  )
  const cancelOk = cancelRestartOk && cancelClearOk
  await pageCancel.close()

  await gameRestart(pageA)

  let peerOk = false
  try {
    await waitPlayersEmpty(pageB, genBefore + 1)
    peerOk = true
  } catch {
    peerOk = false
  }
  const qBLive = await gameQuery(pageB)
  log(
    'Peer B sees empty Player list live after Game Restart on A',
    peerOk && (qBLive.scores || []).length === 0 && !(qBLive.history || []).length,
    `gen=${qBLive.roomGeneration} players=${(qBLive.scores || []).length} hist=${(qBLive.history || []).length}`,
  )
  log(
    'Room Generation bumped on B',
    Number(qBLive.roomGeneration) > genBefore,
    `${genBefore} -> ${qBLive.roomGeneration}`,
  )
  log(
    'Spin waits with no Players (spinAvailable false)',
    qBLive.spinAvailable === false,
    String(qBLive.spinAvailable),
  )

  const remote = await getState(room)
  const placesOk = log(
    'Places/Challenges unchanged after Game Restart',
    Array.isArray(remote.destinations) &&
      remote.destinations.length === seedPlaces.length &&
      remote.destinations.map((d) => d.label).join(',') === 'БАР,КАЗИНО' &&
      JSON.stringify(remote.challenges || {}) === JSON.stringify(seedChallenges),
    `places=${(remote.destinations || []).map((d) => d.label).join(',')} challenges=${JSON.stringify(remote.challenges || {})}`,
  )

  await Promise.all([
    pageA.reload({ waitUntil: 'domcontentloaded' }),
    pageB.reload({ waitUntil: 'domcontentloaded' }),
  ])
  await Promise.all([waitForGame(pageA), waitForGame(pageB)])
  await waitPlayersEmpty(pageA, genBefore + 1)
  await waitPlayersEmpty(pageB, genBefore + 1)
  qA = await gameQuery(pageA)
  const qB = await gameQuery(pageB)
  const refreshOk = log(
    'Refresh A+B still empty of Players',
    (qA.scores || []).length === 0 &&
      (qB.scores || []).length === 0 &&
      Number(qA.roomGeneration) > genBefore &&
      Number(qB.roomGeneration) > genBefore,
    `A gen=${qA.roomGeneration} B gen=${qB.roomGeneration}`,
  )

  await fetch(`${DB}/rooms/${room}/state.json`, { method: 'DELETE' }).catch(() => {})
  fs.writeFileSync(`${OUT}/report.txt`, report.join('\n') + '\n')
  await browser.close()

  const ok = hasRestart && hasClear && noHard && hasShare && peerOk && placesOk && refreshOk && cancelOk && layoutOk
  console.log(ok ? 'GAME RESTART QA GREEN' : 'GAME RESTART QA RED')
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
