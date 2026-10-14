/**
 * Two-client dual done/fail: points apply once to the Round Owner (ADR-0003).
 * Seam: window.Malchishnik.query + Playwright multi-context.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import {
  chromePath,
  gameQuery,
  roomUrl,
  waitForGame,
  waitSpinSettled,
} from './qa-lib.mjs'

const BASE = process.env.QA_URL || process.env.BASE || 'https://zovminga.github.io/malchishnik-spin/'
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa'
fs.mkdirSync(OUT, { recursive: true })

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

function scoreOf(q, name) {
  const row = (q.scores || []).find((p) => new RegExp(name, 'i').test(p.name))
  return row ? Number(row.score) || 0 : 0
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

/** Both phones show done/fail for the same open Round (Azat = Round Owner). */
async function prepareAwardable(pageA, pageB) {
  for (let attempt = 1; attempt <= 14; attempt++) {
    await pageA.locator('.player-chip', { hasText: /Azat/i }).first().click()
    await pageA.waitForTimeout(200)
    await pageA.click('#spinBtn')
    await Promise.all([waitSpinSettled(pageA, 25000), waitSpinSettled(pageB, 25000)])
    await waitAgreedOpen(pageA, pageB)

    const banditA = pageA.locator('#banditBtn')
    const canBandit =
      (await pageA.locator('#banditBox.show').count()) > 0 &&
      !(await banditA.evaluate((el) => el.hidden).catch(() => true))

    if (canBandit) {
      await banditA.click()
      await pageA.waitForTimeout(3500)
      const banditB = pageB.locator('#banditBtn')
      const bHidden = await banditB.evaluate((el) => el.hidden).catch(() => true)
      const bDisabled = await banditB.isDisabled().catch(() => true)
      if (!bHidden && !bDisabled) {
        await banditB.click().catch(() => {})
        await pageB.waitForTimeout(3500)
      }
    }

    await pageA.waitForTimeout(400)
    const actionsA = await pageA.evaluate(() => {
      const el = document.getElementById('scoreActions')
      return !!(el && !el.hidden)
    })
    const actionsB = await pageB.evaluate(() => {
      const el = document.getElementById('scoreActions')
      return !!(el && !el.hidden)
    })
    const doneA = await pageA.locator('#doneBtn').isVisible().catch(() => false)
    const doneB = await pageB.locator('#doneBtn').isVisible().catch(() => false)
    if (doneA && doneB && actionsA && actionsB) {
      const label = await pageA.locator('.result-label').innerText().catch(() => '')
      const q = await gameQuery(pageA)
      return {
        attempt,
        place: label,
        expectedPoints: canBandit ? 2 : 1,
        owner: q.turnOwnerName,
      }
    }
    if (doneA && actionsA) {
      await pageA.click('#doneBtn').catch(() => {})
      await pageA.waitForTimeout(1000)
    } else {
      await pageA.click('#failBtn').catch(() => {})
      await pageA.waitForTimeout(800)
    }
  }
  throw new Error('could not prepare awardable open Round on both clients')
}

// Fire each button's handler on both phones at the same moment. A Playwright click waits
// for the button to be actionable; when the other phone wins, this phone's score buttons
// rightly disappear and that wait used to hang for 30s (flaky on Places without Challenges).
async function pressTogether(pageA, selectorA, pageB, selectorB) {
  const press = (page, selector) => page.evaluate((sel) => document.querySelector(sel).click(), selector)
  await Promise.all([press(pageA, selectorA), press(pageB, selectorB)])
}

/** Night Progress + Round closed agree on both phones after an award. */
async function waitAwardConverged(pageA, pageB, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const qA = await gameQuery(pageA)
    const qB = await gameQuery(pageB)
    const histA = (qA.history || []).length
    const histB = (qB.history || []).length
    if (
      histA >= 1 &&
      histB === histA &&
      !qA.roundOpen &&
      !qB.roundOpen &&
      scoreOf(qA, 'Azat') === scoreOf(qB, 'Azat') &&
      scoreOf(qA, 'Alexander') === scoreOf(qB, 'Alexander')
    ) {
      return { qA, qB, ok: true }
    }
    await pageA.waitForTimeout(200)
  }
  return { qA: await gameQuery(pageA), qB: await gameQuery(pageB), ok: false }
}

const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'

// Seed a Room whose Places all have Challenges (bandit path) or none (attendance path),
// so both scoring paths run every time instead of depending on where the wheel lands.
async function seedRoom(room, withChallenges) {
  const res = await fetch(`${DB}/rooms/${room}/state.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      destinations: [
        { id: 'bar', label: 'БАР', tagline: 'x', color: '#1a6bff', text: '#fff' },
        { id: 'range', label: 'ТИР', tagline: 'y', color: '#2ecc71', text: '#04150a' },
      ],
      challenges: withChallenges ? { bar: ['Шот'], range: ['Мишень'] } : {},
      players: [
        { id: 'qa-azat', name: 'Azat', score: 0 },
        { id: 'qa-alexander', name: 'Alexander', score: 0 },
      ],
      activePlayer: 0,
      history: [],
      updatedAt: Date.now(),
      updatedBy: 'qa-seed',
    }),
  })
  if (!res.ok) throw new Error('seed failed ' + res.status)
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath(),
    args: ['--disable-dev-shm-usage'],
  })
  let ok = true
  for (const withChallenges of [false, true]) {
    ok = (await runRoom(browser, withChallenges)) && ok
  }
  await browser.close()
  process.exit(ok ? 0 : 1)
}

async function runRoom(browser, withChallenges) {
  const kind = withChallenges ? 'challenges' : 'no-challenges'
  console.log(`--- Places with ${kind}`)
  const pageA = await newPage(browser)
  const pageB = await newPage(browser)

  const url = roomUrl(BASE, `qa-dual-award-${kind}-` + Date.now())
  await seedRoom(new URL(url).searchParams.get('room'), withChallenges)
  console.log('url', url)

  await Promise.all([
    pageA.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
    pageB.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
  ])
  await Promise.all([waitForGame(pageA), waitForGame(pageB)])

  let qA = await gameQuery(pageA)
  const buildOk = /build\s+\d+/i.test(qA.build || '')
  console.log(buildOk ? 'PASS | build' : 'FAIL | build', qA.build)
  if (!buildOk) return false

  await pageB.waitForFunction(
    () => (window.Malchishnik.query().scores || []).length >= 2,
    null,
    { timeout: 15000 },
  )

  // --- 1) Non-owner phone awards: points to Round Owner; owner phone must converge ---
  const prep1 = await prepareAwardable(pageA, pageB)
  console.log('prep1', prep1.place, 'expected', prep1.expectedPoints)
  qA = await gameQuery(pageA)
  const azat0 = scoreOf(qA, 'Azat')
  const hist0 = (qA.history || []).length

  await pageB.click('#doneBtn')
  let settled = await waitAwardConverged(pageA, pageB, 15000)
  qA = settled.qA
  let qB = settled.qB
  const histEntry = (qA.history && qA.history[0]) || {}
  const nonOwnerAward =
    settled.ok &&
    /Azat/i.test(histEntry.who || '') &&
    scoreOf(qA, 'Azat') === azat0 + prep1.expectedPoints &&
    scoreOf(qB, 'Azat') === azat0 + prep1.expectedPoints &&
    !/Alexander/i.test(histEntry.who || '')
  console.log(
    nonOwnerAward ? 'PASS | non-owner done awards Round Owner (peers agree)' : 'FAIL | non-owner award / peer sync',
    settled.ok,
    `azat ${azat0}->${scoreOf(qA, 'Azat')}/${scoreOf(qB, 'Azat')}`,
    `open A/B ${qA.roundOpen}/${qB.roundOpen}`,
    histEntry.who,
    histEntry.note,
  )

  // --- 2) Race: both phones press done/fail on the next open Round ---
  const prep2 = await prepareAwardable(pageA, pageB)
  console.log('prep2', prep2.place, 'expected', prep2.expectedPoints)
  qA = await gameQuery(pageA)
  const azatBeforeRace = scoreOf(qA, 'Azat')
  const histBeforeRace = (qA.history || []).length

  await pressTogether(pageA, '#doneBtn', pageB, '#failBtn')
  settled = await waitAwardConverged(pageA, pageB, 15000)
  qA = settled.qA
  qB = settled.qB
  const azatAfterRace = scoreOf(qA, 'Azat')
  const histAfterRace = (qA.history || []).length
  const gained = azatAfterRace - azatBeforeRace
  // done (+expected) or fail (+0) — never both, never 2× done.
  const raceSingle =
    settled.ok &&
    histAfterRace === histBeforeRace + 1 &&
    (gained === prep2.expectedPoints || gained === 0) &&
    scoreOf(qB, 'Azat') === azatAfterRace
  console.log(
    raceSingle ? 'PASS | dual done/fail race = single award' : 'FAIL | dual award race',
    settled.ok,
    `azat ${azatBeforeRace}->${azatAfterRace}`,
    `hist ${histBeforeRace}->${histAfterRace}`,
    (qA.history && qA.history[0] && qA.history[0].note) || '',
  )

  // --- 3) Second press must not double ---
  await pressTogether(pageA, '#doneBtn', pageB, '#doneBtn')
  await pressTogether(pageA, '#failBtn', pageB, '#failBtn')
  await pageA.waitForTimeout(1500)
  qA = await gameQuery(pageA)
  qB = await gameQuery(pageB)
  const noDouble =
    scoreOf(qA, 'Azat') === azatAfterRace &&
    scoreOf(qB, 'Azat') === azatAfterRace &&
    (qA.history || []).length === histAfterRace &&
    (qB.history || []).length === histAfterRace
  console.log(
    noDouble ? 'PASS | second press does not double-award' : 'FAIL | second press doubled',
    `azat ${azatAfterRace}->${scoreOf(qA, 'Azat')}/${scoreOf(qB, 'Azat')}`,
    `hist ${histAfterRace}->${(qA.history || []).length}`,
  )

  // Round closed; Turn Player advanced after last award.
  const closed =
    !qA.roundOpen &&
    !qB.roundOpen &&
    /Alexander/i.test(qA.turnOwnerName || '') &&
    /Alexander/i.test(qB.turnOwnerName || '')
  console.log(
    closed ? 'PASS | Round closed, Turn Player advanced' : 'FAIL | Round/turn not advanced',
    qA.turnOwnerName,
    qB.turnOwnerName,
  )

  await pageA.screenshot({ path: `${OUT}/dual-award-${kind}-a.png`, fullPage: true })
  await pageB.screenshot({ path: `${OUT}/dual-award-${kind}-b.png`, fullPage: true })
  await pageA.context().close()
  await pageB.context().close()
  return buildOk && nonOwnerAward && raceSingle && noDouble && closed
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
