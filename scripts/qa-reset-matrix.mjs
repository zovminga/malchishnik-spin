/**
 * Ticket 03: Maximum multi-device reset QA matrix (ADR-0005).
 * Seam: window.Malchishnik.query + Playwright multi-context (+ Firebase room).
 *
 * Covers matrix rows beyond qa-score-clear / qa-game-restart:
 * dual Score Clear race, dual Game Restart race, clear during open Round,
 * post-clear empty join, post-restart roster rebuild, Turn Player after clear,
 * stale older Room Generation cannot resurrect scores, copy-link still usable.
 * Isolated ?room= ids only — never the default party Room.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import {
  artifactDir,
  chromePath,
  ensurePlayers,
  gameQuery,
  gameRestart,
  qaBase,
  resetGame,
  roomUrl,
  waitForGame,
} from './qa-lib.mjs'

const BASE = qaBase()
const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const DEFAULT_PARTY_ROOM = 'malchishnik'
const OUT = artifactDir('qa-reset-matrix')

const report = []
let failures = 0

function log(step, ok, detail) {
  const line = `${ok ? 'PASS' : 'FAIL'} | ${step}${detail != null && detail !== '' ? ' — ' + detail : ''}`
  report.push(line)
  console.log(line)
  if (!ok) failures++
  return ok
}

function roomIdFromUrl(url) {
  try {
    return new URL(url).searchParams.get('room') || ''
  } catch {
    return ''
  }
}

function assertIsolatedRoom(url, label) {
  const room = roomIdFromUrl(url)
  return log(
    `${label}: isolated ?room= (not default party)`,
    !!room && room !== DEFAULT_PARTY_ROOM && !/^malchishnik$/i.test(room),
    `room=${room}`,
  )
}

async function putState(room, obj) {
  const res = await fetch(`${DB}/rooms/${room}/state.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
  if (!res.ok) throw new Error('PUT failed ' + res.status)
}

async function deleteRoom(room) {
  await fetch(`${DB}/rooms/${room}/state.json`, { method: 'DELETE' }).catch(() => {})
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

function scoresZero(q, minPlayers = 2) {
  const scores = q.scores || []
  return scores.length >= minPlayers && scores.every((p) => Number(p.score) === 0)
}

function historyEmpty(q) {
  return !q.history || q.history.length === 0
}

function playerNames(q) {
  return (q.scores || []).map((p) => p.name).join(',')
}

async function waitCleared(page, minGen, minPlayers = 2, timeout = 20000) {
  await page.waitForFunction(
    ({ gen, min }) => {
      const q = window.Malchishnik.query()
      const scores = q.scores || []
      const zeros = scores.length >= min && scores.every((p) => Number(p.score) === 0)
      const emptyLog = !q.history || q.history.length === 0
      const genOk = typeof q.roomGeneration === 'number' && q.roomGeneration >= gen
      return zeros && emptyLog && !q.roundOpen && genOk
    },
    { gen: minGen, min: minPlayers },
    { timeout },
  )
}

async function waitPlayersEmpty(page, minGen, timeout = 20000) {
  await page.waitForFunction(
    (gen) => {
      const q = window.Malchishnik.query()
      return (
        (!q.scores || q.scores.length === 0) &&
        (!q.history || q.history.length === 0) &&
        !q.roundOpen &&
        typeof q.roomGeneration === 'number' &&
        q.roomGeneration >= gen
      )
    },
    minGen,
    { timeout },
  )
}

async function waitRoundClosed(page, minGen, timeout = 20000) {
  await page.waitForFunction(
    (gen) => {
      const q = window.Malchishnik.query()
      return (
        !q.roundOpen &&
        typeof q.roomGeneration === 'number' &&
        q.roomGeneration >= gen &&
        (q.scores || []).every((p) => Number(p.score) === 0)
      )
    },
    minGen,
    { timeout },
  )
}

/** Poll briefly: scores must stay zero (no bounce back from a losing peer write). */
async function assertNoScoreBounce(pageA, pageB, ms = 3500) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const qA = await gameQuery(pageA)
    const qB = await gameQuery(pageB)
    if (!scoresZero(qA) || !scoresZero(qB) || !historyEmpty(qA) || !historyEmpty(qB)) {
      return {
        ok: false,
        detail: `A=${playerNames(qA)}:${(qA.scores || []).map((p) => p.score).join('/')} B=${(qB.scores || []).map((p) => p.score).join('/')}`,
      }
    }
    await pageA.waitForTimeout(250)
  }
  return { ok: true, detail: 'stayed zeros' }
}

const seedPlaces = [
  { id: 'bar', label: 'БАР', tagline: 'x', color: '#1a6bff', text: '#fff' },
  { id: 'casino', label: 'КАЗИНО', tagline: 'y', color: '#ff003c', text: '#fff' },
]

function baseSeed(extra = {}) {
  return {
    players: [
      { name: 'Azat', score: 5 },
      { name: 'Alexander', score: 3 },
    ],
    activePlayer: 1,
    round: null,
    history: [{ who: 'Azat', place: 'БАР', note: 'выполнил (+2)', color: '#1a6bff' }],
    destinations: seedPlaces,
    challenges: { bar: ['тост'], casino: ['ставка'] },
    roomGeneration: 0,
    updatedAt: Date.now(),
    updatedBy: 'seed',
    ...extra,
  }
}

async function openPair(browser, roomPrefix, seed) {
  const url = roomUrl(BASE, roomPrefix + Date.now())
  const room = roomIdFromUrl(url)
  await putState(room, seed)
  const pageA = await newPage(browser)
  const pageB = await newPage(browser)
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
  return { url, room, pageA, pageB }
}

async function closePair(pageA, pageB, room) {
  await pageA.context().close().catch(() => {})
  await pageB.context().close().catch(() => {})
  await deleteRoom(room)
}

// --- Matrix scenarios ---

async function scenarioDualScoreClear(browser) {
  console.log('\n--- Dual Score Clear race ---')
  const { url, room, pageA, pageB } = await openPair(browser, 'qa-dual-clear-', baseSeed())
  assertIsolatedRoom(url, 'dual Score Clear')
  const q0 = await gameQuery(pageA)
  const genBefore = Number(q0.roomGeneration) || 0

  await Promise.all([resetGame(pageA), resetGame(pageB)])

  let settled = false
  try {
    await Promise.all([waitCleared(pageA, genBefore + 1), waitCleared(pageB, genBefore + 1)])
    settled = true
  } catch {
    settled = false
  }
  const qA = await gameQuery(pageA)
  const qB = await gameQuery(pageB)
  const genA = Number(qA.roomGeneration) || 0
  const genB = Number(qB.roomGeneration) || 0
  log(
    'Dual Score Clear → zeros + empty log on A and B',
    settled && scoresZero(qA) && scoresZero(qB) && historyEmpty(qA) && historyEmpty(qB),
    `A gen=${genA} B gen=${genB} scoresA=${(qA.scores || []).map((p) => p.score).join(',')} scoresB=${(qB.scores || []).map((p) => p.score).join(',')}`,
  )
  log(
    'Dual Score Clear → one coherent Room Generation on both peers',
    genA === genB && genA > genBefore,
    `${genBefore} -> A=${genA} B=${genB}`,
  )
  const bounce = await assertNoScoreBounce(pageA, pageB)
  log('Dual Score Clear → no score bounce after settle', bounce.ok, bounce.detail)

  await closePair(pageA, pageB, room)
}

async function scenarioDualGameRestart(browser) {
  console.log('\n--- Dual Game Restart race ---')
  const { url, room, pageA, pageB } = await openPair(browser, 'qa-dual-restart-', baseSeed())
  assertIsolatedRoom(url, 'dual Game Restart')
  const q0 = await gameQuery(pageA)
  const genBefore = Number(q0.roomGeneration) || 0

  await Promise.all([gameRestart(pageA), gameRestart(pageB)])

  let settled = false
  try {
    await Promise.all([waitPlayersEmpty(pageA, genBefore + 1), waitPlayersEmpty(pageB, genBefore + 1)])
    settled = true
  } catch {
    settled = false
  }
  const qA = await gameQuery(pageA)
  const qB = await gameQuery(pageB)
  log(
    'Dual Game Restart → empty Players everywhere',
    settled &&
      (qA.scores || []).length === 0 &&
      (qB.scores || []).length === 0 &&
      historyEmpty(qA) &&
      historyEmpty(qB),
    `A players=${(qA.scores || []).length} B players=${(qB.scores || []).length} genA=${qA.roomGeneration} genB=${qB.roomGeneration}`,
  )
  log(
    'Dual Game Restart → coherent Room Generation',
    Number(qA.roomGeneration) === Number(qB.roomGeneration) &&
      Number(qA.roomGeneration) > genBefore,
    `A=${qA.roomGeneration} B=${qB.roomGeneration}`,
  )

  await closePair(pageA, pageB, room)
}

async function scenarioClearOpenRound(browser) {
  console.log('\n--- Score Clear during open Round ---')
  const seed = baseSeed({
    activePlayer: 0,
    round: {
      owner: 0,
      placeId: 'bar',
      placeLabel: 'БАР',
      placeColor: '#1a6bff',
      challenge: null,
      scored: false,
      token: 'qa-open-clear-' + Date.now(),
    },
  })
  const { url, room, pageA, pageB } = await openPair(browser, 'qa-clear-open-', seed)
  assertIsolatedRoom(url, 'clear open Round')

  await pageA.waitForFunction(() => window.Malchishnik.query().roundOpen === true, null, {
    timeout: 15000,
  })
  await pageB.waitForFunction(() => window.Malchishnik.query().roundOpen === true, null, {
    timeout: 15000,
  })
  const q0 = await gameQuery(pageA)
  const genBefore = Number(q0.roomGeneration) || 0
  log('Open Round visible on both peers before clear', q0.roundOpen === true, String(q0.roundOpen))

  await resetGame(pageA)

  let closed = false
  try {
    await Promise.all([waitRoundClosed(pageA, genBefore + 1), waitRoundClosed(pageB, genBefore + 1)])
    closed = true
  } catch {
    closed = false
  }
  const qA = await gameQuery(pageA)
  const qB = await gameQuery(pageB)
  log(
    'Score Clear during open Round closes Round for all peers',
    closed && !qA.roundOpen && !qB.roundOpen && scoresZero(qA) && scoresZero(qB),
    `open A/B ${qA.roundOpen}/${qB.roundOpen} genA=${qA.roomGeneration} genB=${qB.roomGeneration}`,
  )

  await closePair(pageA, pageB, room)
}

async function scenarioEmptyJoinAfterClear(browser) {
  console.log('\n--- Fresh empty join after Score Clear ---')
  const { url, room, pageA, pageB } = await openPair(browser, 'qa-clear-join-', baseSeed())
  assertIsolatedRoom(url, 'empty join after clear')
  const q0 = await gameQuery(pageA)
  const genBefore = Number(q0.roomGeneration) || 0

  await resetGame(pageA)
  await waitCleared(pageA, genBefore + 1)
  await waitCleared(pageB, genBefore + 1)
  const clearedGen = Number((await gameQuery(pageA)).roomGeneration) || 0

  // Fresh empty phone — no local Night Progress to restore.
  const pageC = await newPage(browser)
  await pageC.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(pageC)
  await waitCleared(pageC, clearedGen)
  const qC = await gameQuery(pageC)
  const noRestore =
    scoresZero(qC) &&
    historyEmpty(qC) &&
    Number(qC.roomGeneration) >= clearedGen &&
    !(qC.scores || []).some((p) => Number(p.score) >= 3)
  log(
    'After Score Clear, fresh empty join sees cleared Room (no pre-clear restore)',
    noRestore,
    `gen=${qC.roomGeneration} scores=${(qC.scores || []).map((p) => p.name + ':' + p.score).join(',')} hist=${(qC.history || []).length}`,
  )

  await pageC.context().close().catch(() => {})
  await closePair(pageA, pageB, room)
}

async function scenarioRosterRebuildAfterRestart(browser) {
  console.log('\n--- Roster rebuild after Game Restart ---')
  const { url, room, pageA, pageB } = await openPair(browser, 'qa-restart-roster-', baseSeed())
  assertIsolatedRoom(url, 'roster after restart')
  const q0 = await gameQuery(pageA)
  const genBefore = Number(q0.roomGeneration) || 0

  await gameRestart(pageA)
  await waitPlayersEmpty(pageA, genBefore + 1)
  await waitPlayersEmpty(pageB, genBefore + 1)

  await ensurePlayers(pageA, ['Misha', 'Kostya'])
  await pageB.waitForFunction(
    () => {
      const names = (window.Malchishnik.query().scores || []).map((p) => p.name)
      return names.includes('Misha') && names.includes('Kostya')
    },
    null,
    { timeout: 15000 },
  )
  const qB = await gameQuery(pageB)
  const names = (qB.scores || []).map((p) => p.name)
  const zeros = (qB.scores || []).every((p) => Number(p.score) === 0)
  log(
    'After Game Restart, Players added on A appear on B with zero scores',
    names.includes('Misha') && names.includes('Kostya') && zeros && (qB.scores || []).length === 2,
    `names=${names.join(',')} scores=${(qB.scores || []).map((p) => p.score).join(',')}`,
  )

  await closePair(pageA, pageB, room)
}

async function scenarioNamesOrderTurnPlayer(browser) {
  console.log('\n--- Score Clear preserves names/order; Turn Player = first ---')
  // activePlayer starts on Alexander (index 1); after clear must become Azat (first).
  const { url, room, pageA, pageB } = await openPair(
    browser,
    'qa-clear-turn-',
    baseSeed({ activePlayer: 1 }),
  )
  assertIsolatedRoom(url, 'names/order/turn')
  const before = await gameQuery(pageA)
  log(
    'Pre-clear Turn Player is second Player (Alexander)',
    /Alexander/i.test(before.turnOwnerName || ''),
    before.turnOwnerName,
  )
  const genBefore = Number(before.roomGeneration) || 0

  await resetGame(pageA)
  await waitCleared(pageA, genBefore + 1)
  await waitCleared(pageB, genBefore + 1)
  const qA = await gameQuery(pageA)
  const qB = await gameQuery(pageB)
  log(
    'Score Clear preserves Player names/order',
    playerNames(qA) === 'Azat,Alexander' && playerNames(qB) === 'Azat,Alexander',
    `A=${playerNames(qA)} B=${playerNames(qB)}`,
  )
  log(
    'After Score Clear, Turn Player is the first Player',
    /Azat/i.test(qA.turnOwnerName || '') &&
      /Azat/i.test(qB.turnOwnerName || '') &&
      Number(qA.turnOwner) === 0 &&
      Number(qB.turnOwner) === 0,
    `A=${qA.turnOwnerName}(${qA.turnOwner}) B=${qB.turnOwnerName}(${qB.turnOwner})`,
  )

  await closePair(pageA, pageB, room)
}

async function scenarioStaleOlderGeneration(browser) {
  console.log('\n--- Stale older Room Generation cannot resurrect scores ---')
  const { url, room, pageA, pageB } = await openPair(browser, 'qa-stale-gen-', baseSeed())
  assertIsolatedRoom(url, 'stale generation')
  const q0 = await gameQuery(pageA)
  const genBefore = Number(q0.roomGeneration) || 0

  await resetGame(pageA)
  await waitCleared(pageA, genBefore + 1)
  await waitCleared(pageB, genBefore + 1)
  const cleared = await gameQuery(pageA)
  const clearedGen = Number(cleared.roomGeneration) || 0

  // Inject thinner older generation with rich Night Progress (stale award / peer write).
  // Clients must reject via MergePolicy and keep cleared Room (observe via Malchishnik.query).
  await putState(room, {
    players: [
      { name: 'Azat', score: 99 },
      { name: 'Alexander', score: 88 },
    ],
    activePlayer: 0,
    round: null,
    history: [{ who: 'Azat', place: 'БАР', note: 'stale (+99)', color: '#1a6bff' }],
    destinations: seedPlaces,
    challenges: { bar: ['тост'], casino: ['ставка'] },
    roomGeneration: Math.max(0, clearedGen - 1),
    updatedAt: Date.now() + 999999,
    updatedBy: 'stale-older-gen',
  })

  await pageA.waitForTimeout(2500)
  const bounce = await assertNoScoreBounce(pageA, pageB, 3000)
  const qA = await gameQuery(pageA)
  const qB = await gameQuery(pageB)
  const held =
    bounce.ok &&
    scoresZero(qA) &&
    scoresZero(qB) &&
    historyEmpty(qA) &&
    historyEmpty(qB) &&
    Number(qA.roomGeneration) >= clearedGen &&
    Number(qB.roomGeneration) >= clearedGen &&
    !(qA.scores || []).some((p) => Number(p.score) >= 88)
  log(
    'Stale award / thinner older Room Generation cannot resurrect scores after clear',
    held,
    `clearedGen=${clearedGen} A gen=${qA.roomGeneration} scores=${(qA.scores || []).map((p) => p.score).join(',')} hist=${(qA.history || []).length}`,
  )

  await closePair(pageA, pageB, room)
}

async function scenarioCopyLink(browser) {
  console.log('\n--- Copy-link still present/usable ---')
  const url = roomUrl(BASE, 'qa-copy-link-' + Date.now())
  assertIsolatedRoom(url, 'copy-link')
  const room = roomIdFromUrl(url)
  await putState(room, baseSeed())

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {})
  const page = await context.newPage()
  page.on('dialog', async (d) => {
    await d.accept()
  })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(page)

  const share = page.locator('#shareFriendsBtn')
  const present = (await share.count()) === 1
  log('Copy-link control #shareFriendsBtn present', present)

  const layoutOk = await page.evaluate(() => {
    const shareEl = document.getElementById('shareFriendsBtn')
    const clear = document.getElementById('scoreClearBtn')
    const restart = document.getElementById('gameRestartBtn')
    const top = document.querySelector('.top-actions')
    if (!shareEl || !clear || !restart) return false
    if (top && !top.contains(shareEl)) return false
    if (top && (top.contains(clear) || top.contains(restart))) return false
    return true
  })
  log('Copy-link stays top primary after reset UI move', layoutOk)

  let dialogOrClip = false
  page.once('dialog', async (d) => {
    dialogOrClip = true
    await d.accept().catch(() => {})
  })
  await share.click()
  await page.waitForTimeout(600)
  let clipOk = false
  try {
    const text = await page.evaluate(async () => {
      try {
        return await navigator.clipboard.readText()
      } catch {
        return ''
      }
    })
    clipOk = typeof text === 'string' && text.length > 0 && /index\.html|\?room=|malchishnik/i.test(text)
  } catch {
    clipOk = false
  }
  // Usable = click succeeds and either clipboard filled or confirm/prompt dialog fired.
  log(
    'Copy-link control usable after UI move',
    present && (clipOk || dialogOrClip),
    `clipOk=${clipOk} dialog=${dialogOrClip}`,
  )

  await context.close().catch(() => {})
  await deleteRoom(room)
}

async function main() {
  console.log('BASE', BASE)
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath(),
    args: ['--disable-dev-shm-usage'],
  })

  try {
    await scenarioDualScoreClear(browser)
    await scenarioDualGameRestart(browser)
    await scenarioClearOpenRound(browser)
    await scenarioEmptyJoinAfterClear(browser)
    await scenarioRosterRebuildAfterRestart(browser)
    await scenarioNamesOrderTurnPlayer(browser)
    await scenarioStaleOlderGeneration(browser)
    await scenarioCopyLink(browser)
  } finally {
    await browser.close().catch(() => {})
  }

  fs.writeFileSync(`${OUT}/report.txt`, report.join('\n') + '\n')
  console.log('\n=== RESET MATRIX SUMMARY ===')
  console.log(`failures: ${failures}`)
  console.log(failures === 0 ? 'RESET MATRIX QA GREEN' : 'RESET MATRIX QA RED')
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
