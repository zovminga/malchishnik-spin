/**
 * Third client joins during an open Round: Night Progress and Round Owner held (ADR-0001, ADR-0003).
 * Seam: window.Malchishnik.query + Playwright multi-context (+ Firebase room read).
 */
import { chromium } from 'playwright'
import {
  artifactDir,
  chromePath,
  ensurePlayers,
  gameQuery,
  pageRichness,
  qaBase,
  resetGame,
  roomUrl,
  waitForGame,
  waitSpinSettled,
} from './qa-lib.mjs'

const BASE = qaBase()
const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const OUT = artifactDir('qa-mid-round-join')

function roomIdFromUrl(url) {
  try {
    return new URL(url).searchParams.get('room') || ''
  } catch {
    return ''
  }
}

async function fetchRoomState(room) {
  const res = await fetch(`${DB}/rooms/${room}/state.json`)
  if (!res.ok) throw new Error('GET room failed ' + res.status)
  return res.json()
}

async function newPage(browser) {
  const page = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage()
  page.on('dialog', async (d) => d.accept())
  return page
}

async function waitAgreedOpen(pageA, pageB, timeout = 25000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const qA = await gameQuery(pageA)
    const qB = await gameQuery(pageB)
    if (
      qA.roundOpen &&
      qB.roundOpen &&
      qA.turnOwnerName &&
      qA.turnOwnerName === qB.turnOwnerName &&
      !qA.spinning &&
      !qB.spinning
    ) {
      return qA.turnOwnerName
    }
    await pageA.waitForTimeout(200)
  }
  const qA = await gameQuery(pageA)
  const qB = await gameQuery(pageB)
  throw new Error(
    `clients never agreed on open Round: A=${qA.turnOwnerName}/${qA.roundOpen} B=${qB.turnOwnerName}/${qB.roundOpen}`,
  )
}

/** Land an open Round with a Place shown (score actions ready or bandit available). */
async function openSettledRound(pageA, pageB) {
  for (let attempt = 1; attempt <= 10; attempt++) {
    await pageA.locator('.player-chip', { hasText: /Azat/i }).first().click()
    await pageA.waitForTimeout(150)
    await pageA.click('#spinBtn')
    await Promise.all([waitSpinSettled(pageA, 25000), waitSpinSettled(pageB, 25000)])
    const owner = await waitAgreedOpen(pageA, pageB)
    const label = await pageA.locator('.result-label').innerText().catch(() => '')
    if (label) return { owner, place: label, attempt }
  }
  throw new Error('could not open a settled Round with Place')
}

function scoreMap(q) {
  const out = {}
  for (const p of q.scores || []) out[p.name] = Number(p.score) || 0
  return out
}

function scoresEqual(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    if ((a[k] || 0) !== (b[k] || 0)) return false
  }
  return true
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath(),
    args: ['--disable-dev-shm-usage'],
  })
  const pageA = await newPage(browser)
  const pageB = await newPage(browser)

  const url = roomUrl(BASE, 'qa-mid-join-' + Date.now())
  const room = roomIdFromUrl(url)
  console.log('url', url)

  await Promise.all([
    pageA.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
    pageB.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
  ])
  await Promise.all([waitForGame(pageA), waitForGame(pageB)])

  let qA = await gameQuery(pageA)
  const buildOk = /build\s+\d+/i.test(qA.build || '')
  console.log(buildOk ? 'PASS | build' : 'FAIL | build', qA.build)
  if (!buildOk) {
    await browser.close()
    process.exit(1)
  }

  await resetGame(pageA)
  await pageA.waitForTimeout(800)
  await ensurePlayers(pageA, ['Azat', 'Alexander'])
  await pageB.waitForFunction(
    () => (window.Malchishnik.query().scores || []).length >= 2,
    null,
    { timeout: 15000 },
  )

  // Seed Night Progress: one scored entry so join cannot hide behind empty history.
  const seeded = await openSettledRound(pageA, pageB)
  const banditVisible =
    (await pageA.locator('#banditBox.show').count()) > 0 &&
    !(await pageA.locator('#banditBtn').evaluate((el) => el.hidden).catch(() => true))
  if (banditVisible) {
    await pageA.click('#banditBtn')
    await pageA.waitForTimeout(3500)
  }
  await pageA.click('#doneBtn')
  await pageA.waitForFunction(() => !window.Malchishnik.query().roundOpen, null, {
    timeout: 15000,
  })
  await pageB.waitForFunction(() => !window.Malchishnik.query().roundOpen, null, {
    timeout: 15000,
  })
  console.log('seeded history via', seeded.place)

  const open = await openSettledRound(pageA, pageB)
  const beforeRemote = await fetchRoomState(room)
  qA = await gameQuery(pageA)
  let qB = await gameQuery(pageB)
  const beforeRich = qA.richness
  const beforeScores = scoreMap(qA)
  const beforeHist = (qA.history || []).length
  const beforeOwner = open.owner
  const beforeToken = beforeRemote && beforeRemote.round && beforeRemote.round.token
  const beforeSnapOk =
    qA.roundOpen &&
    qB.roundOpen &&
    qA.turnOwnerName === beforeOwner &&
    qB.turnOwnerName === beforeOwner &&
    beforeHist >= 1 &&
    !!beforeToken &&
    beforeRich > 0
  console.log(
    beforeSnapOk ? 'PASS | pre-join Night Progress + open Round' : 'FAIL | pre-join snapshot',
    { beforeOwner, beforeRich, beforeHist, beforeToken, scores: beforeScores },
  )

  // --- Third phone joins mid-Round with thinner local Night Progress ---
  // Seed empty localStorage (fresh updatedAt) so a buggy join would push a wipe.
  const thinLocal = {
    players: [],
    activePlayer: 0,
    round: null,
    history: [],
    destinations: [{ id: 'x', label: 'X', tagline: '', color: '#111', text: '#fff' }],
    challenges: { x: [] },
    updatedAt: Date.now() + 60_000,
    updatedBy: 'thin-joiner',
  }
  const ctxC = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  await ctxC.addInitScript((seed) => {
    try {
      localStorage.setItem('malchishnik-state-v3', JSON.stringify(seed))
      localStorage.removeItem('malchishnik-sync-v1')
    } catch (e) {}
  }, thinLocal)
  const pageC = await ctxC.newPage()
  pageC.on('dialog', async (d) => d.accept())
  await pageC.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(pageC)

  // Wait until joiner mirrors Room (Night Progress + open Round Owner).
  const joinStart = Date.now()
  let qC = null
  let joined = false
  while (Date.now() - joinStart < 20000) {
    qC = await gameQuery(pageC)
    if (
      qC.roundOpen &&
      qC.turnOwnerName === beforeOwner &&
      (qC.history || []).length === beforeHist &&
      scoresEqual(scoreMap(qC), beforeScores) &&
      qC.richness >= beforeRich
    ) {
      joined = true
      break
    }
    await pageC.waitForTimeout(200)
  }
  console.log(
    joined ? 'PASS | joiner sees Night Progress + Round Owner' : 'FAIL | joiner mismatch',
    qC && {
      owner: qC.turnOwnerName,
      roundOpen: qC.roundOpen,
      rich: qC.richness,
      hist: (qC.history || []).length,
      scores: scoreMap(qC),
    },
  )

  // Hold window: empty join must not wipe Room or steal Round.
  await pageC.waitForTimeout(3500)
  const afterRemote = await fetchRoomState(room)
  qA = await gameQuery(pageA)
  qB = await gameQuery(pageB)
  qC = await gameQuery(pageC)
  const rAfter = await pageRichness(pageA, afterRemote)
  const afterToken = afterRemote && afterRemote.round && afterRemote.round.token
  const afterScored = !!(afterRemote && afterRemote.round && afterRemote.round.scored)

  const roomHeld =
    rAfter >= beforeRich &&
    afterToken === beforeToken &&
    !afterScored &&
    ((afterRemote.history || []).length || 0) >= beforeHist
  const peersHeld =
    qA.roundOpen &&
    qB.roundOpen &&
    qC.roundOpen &&
    qA.turnOwnerName === beforeOwner &&
    qB.turnOwnerName === beforeOwner &&
    qC.turnOwnerName === beforeOwner &&
    qA.richness >= beforeRich &&
    qB.richness >= beforeRich &&
    qC.richness >= beforeRich &&
    scoresEqual(scoreMap(qA), beforeScores) &&
    scoresEqual(scoreMap(qB), beforeScores) &&
    scoresEqual(scoreMap(qC), beforeScores) &&
    (qA.history || []).length === beforeHist &&
    (qB.history || []).length === beforeHist &&
    (qC.history || []).length === beforeHist
  console.log(
    roomHeld && peersHeld
      ? 'PASS | mid-round join kept Night Progress + Round Owner'
      : 'FAIL | wipe or steal after mid-round join',
    {
      rAfter,
      afterToken,
      owners: [qA.turnOwnerName, qB.turnOwnerName, qC.turnOwnerName],
      rich: [qA.richness, qB.richness, qC.richness],
    },
  )

  await pageA.screenshot({ path: OUT + '/mid-join-a.png', fullPage: true })
  await pageB.screenshot({ path: OUT + '/mid-join-b.png', fullPage: true })
  await pageC.screenshot({ path: OUT + '/mid-join-c.png', fullPage: true })
  await ctxC.close()
  await browser.close()

  const ok = buildOk && beforeSnapOk && joined && roomHeld && peersHeld
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
