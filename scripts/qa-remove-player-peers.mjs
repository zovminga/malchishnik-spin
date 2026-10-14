/**
 * Removing a Player sticks for every phone: peers see the removal, their later
 * writes (even from a copy that still had the Player) do not bring them back,
 * other Players keep their scores and Room Generation does not move.
 * Seam: window.Malchishnik.query + Playwright multi-context (+ Firebase room).
 * Isolated ?room= ids only — never the default party Room.
 */
import { chromium } from 'playwright'

import { chromePath, ensurePlayers, gameQuery, qaBase, roomUrl, waitForGame } from './qa-lib.mjs'

const BASE = qaBase()
const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const SYNC_MS = 10000

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

const roster = (q) => q.scores.map((p) => `${p.name}:${p.score}`).join(',')
const hasName = (q, name) => q.scores.some((p) => p.name === name)

async function removePlayer(page, name) {
  await page.getByRole('button', { name: `Удалить ${name}` }).first().click()
}

async function waitGone(page, name) {
  return page
    .waitForFunction((n) => !window.Malchishnik.query().scores.some((p) => p.name === n), name, {
      timeout: SYNC_MS,
    })
    .then(() => true)
    .catch(() => false)
}

async function finishOpenRound(page) {
  await page.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      return q.roundOpen && !q.spinning && document.getElementById('banditBox').classList.contains('show')
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

async function playRound(page) {
  await page.click('#spinBtn')
  await finishOpenRound(page)
}

async function removalSticks(browser) {
  const room = 'qa-remove-peers-' + Date.now()
  const A = await newPhone(browser)
  const B = await newPhone(browser)
  await openRoom(A, room)
  await ensurePlayers(A.page, ['Azat', 'Ivan', 'Petr'])
  await openRoom(B, room)
  await playRound(B.page)
  await A.page.waitForFunction(() => window.Malchishnik.query().history.length === 1, null, {
    timeout: SYNC_MS,
  })
  const before = await gameQuery(B.page)

  await removePlayer(A.page, 'Petr')
  log('[idle] peer sees the removal', await waitGone(B.page, 'Petr'), roster(await gameQuery(B.page)))

  // Peer taps a Turn Player chip — a write that does not add Night Progress.
  await B.page.locator('.player-chip', { hasText: 'Ivan' }).first().click()
  await B.page.waitForTimeout(2500)
  let qa = await gameQuery(A.page)
  let qb = await gameQuery(B.page)
  log(
    '[idle] peer chip tap does not bring the Player back',
    !hasName(qa, 'Petr') && !hasName(qb, 'Petr'),
    `A ${roster(qa)} | B ${roster(qb)}`,
  )

  await playRound(B.page)
  await B.page.waitForTimeout(2500)
  qa = await gameQuery(A.page)
  qb = await gameQuery(B.page)
  const azatBefore = before.scores.find((p) => p.name === 'Azat').score
  log(
    '[idle] peer Round does not bring the Player back; scores kept',
    !hasName(qa, 'Petr') &&
      !hasName(qb, 'Petr') &&
      roster(qa) === roster(qb) &&
      qb.history.length === 2 &&
      qb.scores.find((p) => p.name === 'Azat').score >= azatBefore,
    `A ${roster(qa)} | B ${roster(qb)} history=${qb.history.length}`,
  )
  log('[idle] Room Generation unchanged', qa.roomGeneration === before.roomGeneration, `gen=${qa.roomGeneration}`)

  await A.page.reload({ waitUntil: 'domcontentloaded' })
  await waitForGame(A.page)
  await A.page.waitForTimeout(2000)
  qa = await gameQuery(A.page)
  log('[idle] removal survives reload', !hasName(qa, 'Petr') && qa.scores.length === 2, roster(qa))

  // Same name later is a new Player, not the removed one.
  await A.page.fill('#playerInput', 'Petr')
  await A.page.click('#addPlayerBtn')
  await B.page
    .waitForFunction(() => window.Malchishnik.query().scores.some((p) => p.name === 'Petr'), null, {
      timeout: SYNC_MS,
    })
    .catch(() => {})
  qb = await gameQuery(B.page)
  const petr = qb.scores.find((p) => p.name === 'Petr')
  log('[idle] re-adding the same name works and starts at 0', !!petr && petr.score === 0, roster(qb))
  await A.context.close()
  await B.context.close()
}

// The peer is mid-spin when the removal lands, so it ignores the thinner Room
// and later writes its own copy that still has the Player.
async function removalDuringPeerSpin(browser) {
  const room = 'qa-remove-spin-' + Date.now()
  const A = await newPhone(browser)
  const B = await newPhone(browser)
  await openRoom(A, room)
  await ensurePlayers(A.page, ['Azat', 'Ivan', 'Petr'])
  await openRoom(B, room)

  await B.page.click('#spinBtn')
  await A.page.waitForFunction(() => window.Malchishnik.query().roundOpen, null, { timeout: SYNC_MS })
  await removePlayer(A.page, 'Petr')
  await finishOpenRound(B.page)
  await B.page.waitForTimeout(3000)
  const qa = await gameQuery(A.page)
  const qb = await gameQuery(B.page)
  log(
    '[spin] removal during a peer spin sticks; the peer Round is kept',
    !hasName(qa, 'Petr') &&
      !hasName(qb, 'Petr') &&
      roster(qa) === roster(qb) &&
      qa.history.length === 1 &&
      qb.history.length === 1,
    `A ${roster(qa)} history=${qa.history.length} | B ${roster(qb)} history=${qb.history.length}`,
  )
  await A.context.close()
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

// Room written by an older build: Players without any stable id.
async function removalInLegacyRoom(browser) {
  const room = 'qa-remove-legacy-' + Date.now()
  await putState(`${DB}/rooms/${room}/state.json`, {
    destinations: [
      { id: 'bar', label: 'БАР', tagline: 'x', color: '#1a6bff', text: '#fff' },
      { id: 'casino', label: 'КАЗИНО', tagline: 'y', color: '#ff003c', text: '#fff' },
    ],
    challenges: { bar: [], casino: [] },
    players: [
      { name: 'Azat', score: 7 },
      { name: 'Ivan', score: 4 },
      { name: 'Petr', score: 9 },
    ],
    activePlayer: 0,
    history: [{ who: 'Petr', place: 'БАР', note: 'был там (+1)', color: '#1a6bff' }],
    updatedAt: Date.now(),
    updatedBy: 'seed',
  })
  const A = await newPhone(browser)
  const B = await newPhone(browser)
  await openRoom(A, room)
  await openRoom(B, room)
  await removePlayer(A.page, 'Petr')
  log('[legacy] peer sees the removal', await waitGone(B.page, 'Petr'))
  await B.page.locator('.player-chip', { hasText: 'Ivan' }).first().click()
  await B.page.waitForTimeout(2500)
  const qa = await gameQuery(A.page)
  const qb = await gameQuery(B.page)
  log(
    '[legacy] removal sticks; other scores and night log kept',
    roster(qa) === 'Azat:7,Ivan:4' && roster(qb) === 'Azat:7,Ivan:4' && qb.history.length === 1,
    `A ${roster(qa)} | B ${roster(qb)} history=${qb.history.length}`,
  )
  await A.context.close()
  await B.context.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath() })
  try {
    await removalSticks(browser)
    await removalDuringPeerSpin(browser)
    await removalInLegacyRoom(browser)
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
