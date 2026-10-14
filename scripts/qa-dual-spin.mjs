/**
 * Two-client dual spin: at most one open Round; Round Owner who spun keeps it (ADR-0003).
 * Seam: window.Malchishnik.query + Playwright multi-context (+ Firebase room read).
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
  waitSpinSettled,
} from './qa-lib.mjs'

const BASE = process.env.QA_URL || process.env.BASE || 'https://zovminga.github.io/malchishnik-spin/'
const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa'
fs.mkdirSync(OUT, { recursive: true })

function roomIdFromUrl(url) {
  try {
    return new URL(url).searchParams.get('room') || ''
  } catch {
    return ''
  }
}

async function fetchRound(room) {
  const res = await fetch(`${DB}/rooms/${room}/state.json`)
  if (!res.ok) throw new Error('GET room failed ' + res.status)
  const body = await res.json()
  return (body && body.round) || null
}

async function newPage(browser, dialogMode) {
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
    `clients never agreed on open Round: A=${qA.turnOwnerName}/${qA.roundOpen}/${qA.spinning} B=${qB.turnOwnerName}/${qB.roundOpen}/${qB.spinning}`,
  )
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath(),
    args: ['--disable-dev-shm-usage'],
  })
  // Mixed dialog modes: late spin must not replace the open Round even if a confirm were shown.
  const pageA = await newPage(browser, 'dismiss')
  const pageB = await newPage(browser, 'accept')

  const url = roomUrl(BASE, 'qa-dual-spin-' + Date.now())
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

  // --- Race: each phone aims at a different Turn Player, then both spin ---
  await Promise.all([
    (async () => {
      await pageA.locator('.player-chip', { hasText: /Azat/i }).first().click()
      await pageA.click('#spinBtn')
    })(),
    (async () => {
      await pageB.locator('.player-chip', { hasText: /Alexander/i }).first().click()
      await pageB.click('#spinBtn')
    })(),
  ])

  await Promise.all([waitSpinSettled(pageA, 25000), waitSpinSettled(pageB, 25000)])
  const raceOwner = await waitAgreedOpen(pageA, pageB)
  const roundAfterRace = await fetchRound(room)
  const raceToken = roundAfterRace && roundAfterRace.token
  qA = await gameQuery(pageA)
  let qB = await gameQuery(pageB)
  console.log('race owner:', raceOwner, 'token:', raceToken)
  console.log('race A/B:', qA.turnOwnerName, qB.turnOwnerName)

  const raceAgreed =
    qA.roundOpen &&
    qB.roundOpen &&
    qA.turnOwnerName === raceOwner &&
    qB.turnOwnerName === raceOwner &&
    !!raceToken
  console.log(raceAgreed ? 'PASS | race converges to one Round Owner' : 'FAIL | race did not converge')

  // Token must not be replaced by the losing spin shortly after.
  await pageA.waitForTimeout(2500)
  const roundStable = await fetchRound(room)
  const tokenStable = !!(roundStable && roundStable.token === raceToken && !roundStable.scored)
  qA = await gameQuery(pageA)
  qB = await gameQuery(pageB)
  const ownerStable =
    qA.turnOwnerName === raceOwner && qB.turnOwnerName === raceOwner && qA.roundOpen && qB.roundOpen
  console.log(
    tokenStable && ownerStable ? 'PASS | open Round token held' : 'FAIL | open Round overwritten',
    roundStable && roundStable.token,
  )

  // --- Late non-owner spin must not create / replace the open Round ---
  // Spin is disabled while a Round is open (control polish); still probe a force-click.
  qB = await gameQuery(pageB)
  const lateSpinBlocked =
    qB.spinAvailable === false && (await pageB.locator('#spinBtn').isDisabled())
  await pageB.click('#spinBtn', { force: true }).catch(() => {})
  await pageB.waitForTimeout(1000)
  await pageB.click('#spinBtn', { force: true }).catch(() => {})
  await pageB.waitForTimeout(2000)
  await waitSpinSettled(pageB, 25000).catch(() => {})

  const roundLate = await fetchRound(room)
  qA = await gameQuery(pageA)
  qB = await gameQuery(pageB)
  const lateOk =
    lateSpinBlocked &&
    qA.roundOpen &&
    qB.roundOpen &&
    qA.turnOwnerName === raceOwner &&
    qB.turnOwnerName === raceOwner &&
    roundLate &&
    roundLate.token === raceToken
  console.log(
    lateOk ? 'PASS | late spin does not replace open Round' : 'FAIL | late spin replaced Round',
    `blocked=${lateSpinBlocked}`,
    qA.turnOwnerName,
    qB.turnOwnerName,
    roundLate && roundLate.token,
  )

  await pageA.screenshot({ path: OUT + '/dual-spin-a.png', fullPage: true })
  await pageB.screenshot({ path: OUT + '/dual-spin-b.png', fullPage: true })
  await browser.close()

  const ok = buildOk && raceAgreed && tokenStable && ownerStable && lateOk
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
