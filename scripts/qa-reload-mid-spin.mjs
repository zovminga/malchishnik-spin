/**
 * Round Owner reloads or closes the tab mid-spin: the Room must not stay stuck
 * on an open Round forever. Place is on the wire from spin start, so any phone
 * can settle the Round; a legacy open Round without a Place gets an explicit
 * Round Reset that keeps Night Progress and Room Generation.
 * Seam: window.Malchishnik.query + Playwright multi-context (+ Firebase room).
 * Isolated ?room= ids only — never the default party Room.
 */
import { chromium } from 'playwright'

import { chromePath, ensurePlayers, gameQuery, roomUrl, waitForGame } from './qa-lib.mjs'

const BASE = (process.env.QA_URL || process.env.BASE || 'http://127.0.0.1:8765/').replace(
  /\/?$/,
  '/',
)
const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
// Spin animation 5.6s + stall grace — generous for slow CI networks.
const RECOVER_MS = 20000

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

// Wait until this phone can score the open Round (Place landed, score UI usable).
async function waitRoundScorable(page) {
  return page
    .waitForFunction(
      () => {
        const q = window.Malchishnik.query()
        const box = document.getElementById('banditBox')
        const bandit = document.getElementById('banditBtn')
        const banditUsable = box.classList.contains('show') && !bandit.hidden && !bandit.disabled
        return q.roundOpen && !q.spinning && (q.scoreActionsVisible || banditUsable)
      },
      null,
      { timeout: RECOVER_MS },
    )
    .then(() => true)
    .catch(() => false)
}

async function scoreOpenRound(page) {
  const bandit = page.locator('#banditBtn')
  if (!(await bandit.evaluate((el) => el.hidden)) && !(await bandit.isDisabled())) {
    await bandit.click({ force: true })
    await page.waitForFunction(() => window.Malchishnik.query().scoreActionsVisible, null, {
      timeout: 10000,
    })
  }
  await page.locator('#doneBtn').click({ force: true })
  await page.waitForFunction(() => !window.Malchishnik.query().roundOpen, null, { timeout: 10000 })
}

async function waitClosedEverywhere(pages) {
  for (const page of pages) {
    await page
      .waitForFunction(() => !window.Malchishnik.query().roundOpen, null, { timeout: 10000 })
      .catch(() => {})
  }
}

async function spinnerLeavesMidSpin(browser, how) {
  const room = `qa-reload-mid-spin-${how}-${Date.now()}`
  const A = await newPhone(browser)
  const B = await newPhone(browser)
  await openRoom(A, room)
  await ensurePlayers(A.page, ['Azat', 'Alexander'])
  await openRoom(B, room)
  const histBefore = (await gameQuery(B.page)).history.length

  await A.page.click('#spinBtn')
  await A.page.waitForTimeout(1000)
  const bMid = await gameQuery(B.page)
  const bResult = await B.page.locator('#result').innerText()
  log(
    `[${how}] peer sees open Round but no Place before the wheel stops`,
    bMid.roundOpen && !bMid.scoreActionsVisible && /крутит/i.test(bResult),
    `roundOpen=${bMid.roundOpen} score=${bMid.scoreActionsVisible} result=${JSON.stringify(bResult)}`,
  )

  await A.page.waitForTimeout(500)
  if (how === 'reload') {
    await A.page.reload({ waitUntil: 'domcontentloaded' })
    await waitForGame(A.page)
  } else {
    await A.context.close()
  }

  const phones = how === 'reload' ? [A.page, B.page] : [B.page]
  for (const page of phones) {
    const ok = await waitRoundScorable(page)
    const q = await gameQuery(page)
    log(
      `[${how}] Round recovers with its Place on ${page === A.page ? 'spinner' : 'peer'}`,
      ok,
      `roundOpen=${q.roundOpen} score=${q.scoreActionsVisible} spinAvailable=${q.spinAvailable}`,
    )
  }

  const scored = await scoreOpenRound(B.page)
    .then(() => true)
    .catch(() => false)
  log(`[${how}] peer can score the recovered Round`, scored)
  await waitClosedEverywhere(phones)
  for (const page of phones) {
    const q = await gameQuery(page)
    log(
      `[${how}] Round scored, Turn Player can spin again on ${page === A.page ? 'spinner' : 'peer'}`,
      !q.roundOpen && q.spinAvailable && q.history.length === histBefore + 1,
      `roundOpen=${q.roundOpen} spinAvailable=${q.spinAvailable} history=${q.history.length}`,
    )
  }
  await A.context.close().catch(() => {})
  await B.context.close()
}

async function putState(url, obj) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
  if (!res.ok) throw new Error('PUT failed ' + res.status)
}

// Room left by an older build: open Round with no Place, nobody spinning.
async function legacyRoundWithoutPlace(browser) {
  const room = 'qa-round-reset-' + Date.now()
  await putState(`${DB}/rooms/${room}/state.json`, {
    destinations: [
      { id: 'bar', label: 'БАР', tagline: 'x', color: '#1a6bff', text: '#fff' },
      { id: 'casino', label: 'КАЗИНО', tagline: 'y', color: '#ff003c', text: '#fff' },
    ],
    challenges: { bar: [], casino: [] },
    players: [
      { name: 'Azat', score: 7 },
      { name: 'Alexander', score: 4 },
    ],
    activePlayer: 1,
    round: { owner: 1, placeId: null, challenge: null, scored: false, token: 'legacy-stuck' },
    history: [{ who: 'Azat', place: 'БАР', note: 'старый лог (+1)', color: '#1a6bff' }],
    roomGeneration: 3,
    updatedAt: Date.now(),
    updatedBy: 'seed',
  })

  const A = await newPhone(browser)
  const B = await newPhone(browser)
  await openRoom(A, room)
  await openRoom(B, room)

  const resetBtn = A.page.locator('#roundResetBtn')
  log('[legacy] Round Reset hidden right after join', !(await resetBtn.isVisible().catch(() => false)))
  const shown = await resetBtn
    .waitFor({ state: 'visible', timeout: RECOVER_MS })
    .then(() => true)
    .catch(() => false)
  log('[legacy] Round Reset appears for an open Round without a Place', shown)
  if (!shown) {
    await A.context.close()
    await B.context.close()
    return
  }

  await resetBtn.click()
  await waitClosedEverywhere([A.page, B.page])
  await B.page.waitForTimeout(2500)
  for (const [label, page] of [
    ['A', A.page],
    ['B', B.page],
  ]) {
    const q = await gameQuery(page)
    const scores = q.scores.map((p) => `${p.name}:${p.score}`).join(',')
    log(
      `[legacy] Round Reset sticks on ${label}; Night Progress and Room Generation kept`,
      !q.roundOpen &&
        q.spinAvailable &&
        scores === 'Azat:7,Alexander:4' &&
        q.history.length === 1 &&
        q.roomGeneration === 3 &&
        /Alexander/.test(q.turnOwnerName),
      `roundOpen=${q.roundOpen} spinAvailable=${q.spinAvailable} scores=${scores} history=${q.history.length} gen=${q.roomGeneration} turn=${q.turnOwnerName}`,
    )
  }

  await B.page.reload({ waitUntil: 'domcontentloaded' })
  await waitForGame(B.page)
  await B.page.waitForTimeout(2000)
  const qb = await gameQuery(B.page)
  log('[legacy] Round Reset survives reload', !qb.roundOpen && qb.spinAvailable, `roundOpen=${qb.roundOpen}`)
  await A.context.close()
  await B.context.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath() })
  try {
    await spinnerLeavesMidSpin(browser, 'reload')
    await spinnerLeavesMidSpin(browser, 'close')
    await legacyRoundWithoutPlace(browser)
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
