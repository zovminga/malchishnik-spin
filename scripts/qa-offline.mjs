/**
 * Offline phone: a visible «нет связи» bar, no spin / award / Room changes while
 * offline, and nothing lost on either phone after the connection comes back.
 * Seam: window.Malchishnik.query + Playwright multi-context (+ Firebase room).
 * Isolated ?room= ids only — never the default party Room.
 */
import { chromium } from 'playwright'

import { chromePath, ensurePlayers, gameQuery, qaBase, roomUrl, waitForGame } from './qa-lib.mjs'

const BASE = qaBase()
// Firebase may need a few seconds to notice the socket is gone and to reconnect.
const DETECT_MS = 20000

let failures = 0
function log(step, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}

async function newPhone(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
  })
  const page = await context.newPage()
  page.on('dialog', (d) => d.accept())
  return { context, page }
}

async function openRoom(phone, room) {
  await phone.page.goto(roomUrl(BASE, room), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(phone.page)
  await phone.page.waitForTimeout(1500)
}

async function offlineBar(page) {
  return page.locator('#syncBar').evaluate((el) => ({
    visible: !el.hidden && getComputedStyle(el).display !== 'none',
    text: el.textContent || '',
  }))
}

async function waitOffline(page, offline) {
  return page
    .waitForFunction((want) => window.Malchishnik.query().roomOffline === want, offline, {
      timeout: DETECT_MS,
    })
    .then(() => true)
    .catch(() => false)
}

async function playRound(page) {
  await page.click('#spinBtn')
  await page.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      const box = document.getElementById('banditBox')
      return q.roundOpen && !q.spinning && box.classList.contains('show')
    },
    null,
    { timeout: 20000 },
  )
  const bandit = page.locator('#banditBtn')
  if (!(await bandit.evaluate((el) => el.hidden))) {
    await bandit.click({ force: true })
    await page.waitForFunction(() => window.Malchishnik.query().scoreActionsVisible, null, {
      timeout: 10000,
    })
  }
  await page.locator('#doneBtn').click({ force: true })
  await page.waitForFunction(() => !window.Malchishnik.query().roundOpen, null, { timeout: 10000 })
}

// Try a Room change through every main control; force-click past any dimming.
async function tryRoomChanges(page) {
  await page.locator('#spinBtn').click({ force: true, timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(800)
  await page.fill('#playerInput', 'Offline').catch(() => {})
  await page.locator('#addPlayerBtn').click({ force: true, timeout: 2000 }).catch(() => {})
  await page.locator('#scoreClearBtn').click({ force: true, timeout: 2000 }).catch(() => {})
  await page.waitForTimeout(500)
}

const summary = (q) =>
  `scores=${q.scores.map((p) => p.name + ':' + p.score).join(',')} history=${q.history.length} open=${q.roundOpen}`

async function offlineIdlePhone(browser) {
  const room = 'qa-offline-idle-' + Date.now()
  const A = await newPhone(browser)
  const B = await newPhone(browser)
  await openRoom(A, room)
  await ensurePlayers(A.page, ['Azat', 'Alexander', 'Ivan'])
  await openRoom(B, room)
  await playRound(B.page)
  await A.page.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      return q.history.length === 1 && !q.roundOpen
    },
    null,
    { timeout: 10000 },
  )
  const before = await gameQuery(A.page)

  await A.context.setOffline(true)
  const detected = await waitOffline(A.page, true)
  const bar = await offlineBar(A.page)
  log(
    '[idle] offline phone shows «нет связи» bar',
    detected && bar.visible && /нет связи/i.test(bar.text),
    JSON.stringify(bar),
  )
  const qOff = await gameQuery(A.page)
  log('[idle] spin not available while offline', qOff.spinAvailable === false, `spinAvailable=${qOff.spinAvailable}`)

  await tryRoomChanges(A.page)
  const qTried = await gameQuery(A.page)
  log(
    '[idle] offline phone does not change the Room locally',
    !qTried.roundOpen &&
      qTried.scores.length === before.scores.length &&
      qTried.history.length === before.history.length &&
      JSON.stringify(qTried.scores) === JSON.stringify(before.scores),
    summary(qTried),
  )

  const bBar = await offlineBar(B.page)
  log('[idle] online peer has no offline bar', !bBar.visible, JSON.stringify(bBar))

  await playRound(B.page)
  const qB = await gameQuery(B.page)

  await A.context.setOffline(false)
  const back = await waitOffline(A.page, false)
  await A.page
    .waitForFunction((n) => window.Malchishnik.query().history.length === n, qB.history.length, {
      timeout: DETECT_MS,
    })
    .catch(() => {})
  const qA = await gameQuery(A.page)
  const barAfter = await offlineBar(A.page)
  log('[idle] bar clears after reconnect', back && !barAfter.visible, JSON.stringify(barAfter))
  log(
    '[idle] reconnected phone catches up, peer Round not lost',
    JSON.stringify(qA.scores) === JSON.stringify(qB.scores) && qA.history.length === qB.history.length,
    `A ${summary(qA)} | B ${summary(qB)}`,
  )
  await A.page.waitForTimeout(2500)
  const qB2 = await gameQuery(B.page)
  log(
    '[idle] peer keeps its Night Progress after the offline phone returns',
    JSON.stringify(qB2.scores) === JSON.stringify(qB.scores) && qB2.history.length === qB.history.length,
    summary(qB2),
  )
  log('[idle] spin available again after reconnect', qA.spinAvailable === true, `spinAvailable=${qA.spinAvailable}`)
  await A.context.close()
  await B.context.close()
}

// Round Owner's phone drops after the Place lands: it cannot score offline,
// a peer scores, and the award is not doubled when the phone returns.
async function offlineDuringOpenRound(browser) {
  const room = 'qa-offline-round-' + Date.now()
  const A = await newPhone(browser)
  const B = await newPhone(browser)
  await openRoom(A, room)
  await ensurePlayers(A.page, ['Azat', 'Alexander'])
  await openRoom(B, room)

  await A.page.click('#spinBtn')
  await A.page.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      return q.roundOpen && !q.spinning && document.getElementById('banditBox').classList.contains('show')
    },
    null,
    { timeout: 20000 },
  )
  await A.page.waitForTimeout(1000)
  await A.context.setOffline(true)
  const detected = await waitOffline(A.page, true)
  log('[round] Round Owner phone detects offline', detected)

  const bandit = A.page.locator('#banditBtn')
  if (!(await bandit.evaluate((el) => el.hidden))) {
    await bandit.click({ force: true, timeout: 2000 }).catch(() => {})
    await A.page.waitForTimeout(3500)
  }
  await A.page.locator('#doneBtn').click({ force: true, timeout: 2000 }).catch(() => {})
  await A.page.waitForTimeout(800)
  const qOff = await gameQuery(A.page)
  log(
    '[round] offline phone cannot award',
    qOff.roundOpen && qOff.history.length === 0 && qOff.scores.every((p) => p.score === 0),
    summary(qOff),
  )

  // Peer finishes the Round from the table.
  const bBandit = B.page.locator('#banditBtn')
  await B.page.waitForFunction(() => document.getElementById('banditBox').classList.contains('show'), null, {
    timeout: 10000,
  })
  if (!(await bBandit.evaluate((el) => el.hidden))) {
    await bBandit.click({ force: true })
    await B.page.waitForFunction(() => window.Malchishnik.query().scoreActionsVisible, null, {
      timeout: 10000,
    })
  }
  await B.page.locator('#doneBtn').click({ force: true })
  await B.page.waitForFunction(() => !window.Malchishnik.query().roundOpen, null, { timeout: 10000 })
  const qB = await gameQuery(B.page)

  await A.context.setOffline(false)
  await waitOffline(A.page, false)
  await A.page
    .waitForFunction(() => !window.Malchishnik.query().roundOpen, null, { timeout: DETECT_MS })
    .catch(() => {})
  await A.page.waitForTimeout(2500)
  const qA = await gameQuery(A.page)
  const qB2 = await gameQuery(B.page)
  log(
    '[round] one award, both phones agree after reconnect',
    qB.history.length === 1 &&
      JSON.stringify(qA.scores) === JSON.stringify(qB2.scores) &&
      qA.history.length === 1 &&
      qB2.history.length === 1 &&
      !qA.roundOpen,
    `A ${summary(qA)} | B ${summary(qB2)}`,
  )
  await A.context.close()
  await B.context.close()
}

// Phone drops while a peer's Round is open, misses the award and later Rounds:
// after reconnect it must adopt the Room instead of defending its stale open Round.
async function offlineMissesAward(browser) {
  const room = 'qa-offline-stale-' + Date.now()
  const A = await newPhone(browser)
  const B = await newPhone(browser)
  await openRoom(A, room)
  await ensurePlayers(A.page, ['Azat', 'Alexander'])
  await openRoom(B, room)

  await B.page.click('#spinBtn')
  await A.page.waitForFunction(() => window.Malchishnik.query().roundOpen, null, { timeout: 10000 })
  await A.context.setOffline(true)
  await waitOffline(A.page, true)

  await B.page.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      return q.roundOpen && !q.spinning && document.getElementById('banditBox').classList.contains('show')
    },
    null,
    { timeout: 20000 },
  )
  const bandit = B.page.locator('#banditBtn')
  if (!(await bandit.evaluate((el) => el.hidden))) {
    await bandit.click({ force: true })
    await B.page.waitForFunction(() => window.Malchishnik.query().scoreActionsVisible, null, {
      timeout: 10000,
    })
  }
  await B.page.locator('#doneBtn').click({ force: true })
  await B.page.waitForFunction(() => !window.Malchishnik.query().roundOpen, null, { timeout: 10000 })
  await playRound(B.page)
  const qB = await gameQuery(B.page)

  await A.context.setOffline(false)
  await waitOffline(A.page, false)
  await A.page
    .waitForFunction((n) => window.Malchishnik.query().history.length === n, qB.history.length, {
      timeout: DETECT_MS,
    })
    .catch(() => {})
  const qA = await gameQuery(A.page)
  log(
    '[stale] phone that missed the award adopts the Room after reconnect',
    !qA.roundOpen &&
      qA.spinAvailable &&
      JSON.stringify(qA.scores) === JSON.stringify(qB.scores) &&
      qA.history.length === qB.history.length,
    `A ${summary(qA)} spinAvailable=${qA.spinAvailable} | B ${summary(qB)}`,
  )
  await A.context.close()
  await B.context.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath() })
  try {
    await offlineIdlePhone(browser)
    await offlineDuringOpenRound(browser)
    await offlineMissesAward(browser)
  } finally {
    await browser.close()
  }
  console.log(failures ? `FAILED ${failures}` : 'ALL GREEN')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
