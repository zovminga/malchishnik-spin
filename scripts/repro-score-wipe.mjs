/**
 * Feedback loop: "opened link on a new/phone browser → shared scores wiped".
 *
 * Richness comes from window.Malchishnik.richness (RoomState) — not a cloned formula.
 *
 * Usage:
 *   node scripts/repro-score-wipe.mjs   (local server, see README)
 *   BASE=https://zovminga.github.io/malchishnik-spin/ EXPECT=green LOOPS=3 node scripts/repro-score-wipe.mjs
 *
 * Exit 0 = expected verdict
 * Exit 1 = unexpected / scores wiped when EXPECT=green
 * Exit 2 = harness error
 */
import { chromium } from 'playwright'
import { assertTestRoom, chromePath, pageRichness, waitForGame, gameQuery, qaBase } from './qa-lib.mjs'

const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const BASE = qaBase()
const EXPECT = (process.env.EXPECT || 'green').toLowerCase()
const LOOPS = Math.max(1, Number(process.env.LOOPS) || 1)
const MINIMAL = process.env.MINIMAL === '1'
const FRESH_TS = process.env.FRESH_TS === '1'
const CHROME = chromePath()

function seedState() {
  const base = {
    players: [{ name: 'Azat', score: 5 }],
    activePlayer: 0,
    round: null,
    destinations: [{ id: 'bar', label: 'БАР', tagline: 'x', color: '#1a6bff', text: '#fff' }],
    challenges: { bar: ['тест'] },
    updatedAt: FRESH_TS ? Date.now() : 1000,
    updatedBy: 'seed',
  }
  if (!MINIMAL) {
    base.players.push({ name: 'Alexander', score: 3 })
    base.history = [{ who: 'Azat', place: 'БАР', note: 'выполнил (+2)', color: '#1a6bff' }]
    base.destinations.push({
      id: 'casino',
      label: 'КАЗИНО',
      tagline: 'y',
      color: '#ff003c',
      text: '#fff',
    })
    base.challenges.casino = []
  } else {
    base.history = []
  }
  return base
}

async function putState(url, obj) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
  if (!res.ok) throw new Error('PUT failed ' + res.status)
}

async function getState(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error('GET failed ' + res.status)
  return res.json()
}

async function oneJoin(browser, room, stateUrl) {
  const rich = seedState()
  await putState(stateUrl, rich)
  const before = await getState(stateUrl)

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  page.on('dialog', (d) => d.accept())

  const url = `${BASE}index.html?room=${room}&t=${Date.now()}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(page)
  await page.waitForTimeout(3500)

  const q = await gameQuery(page)
  const after = await getState(stateUrl)
  const rBefore = await pageRichness(page, before)
  const rAfter = await pageRichness(page, after)
  const azat = ((after && after.players) || []).find((p) => p.name === 'Azat')
  const azatScore = azat ? azat.score : undefined
  const wiped =
    rAfter < rBefore &&
    (!(after && after.players) || !after.players.some((p) => p.name === 'Azat' && p.score === 5))

  await context.close()
  await fetch(stateUrl, { method: 'DELETE' }).catch(() => {})

  return {
    build: q.build,
    wiped: wiped || azatScore !== 5,
    azatScore,
    rBefore,
    rAfter,
    scores: ((after && after.players) || []).map((p) => `${p.name}:${p.score}`).join(', '),
  }
}

async function main() {
  console.log('BASE', BASE)
  console.log('EXPECT', EXPECT, 'LOOPS', LOOPS, 'MINIMAL', MINIMAL, 'FRESH_TS', FRESH_TS)

  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ['--no-sandbox'],
  })

  let reds = 0
  let last = null
  for (let i = 0; i < LOOPS; i++) {
    const room = assertTestRoom('qa-wipe-' + Date.now() + '-' + i)
    const stateUrl = `${DB}/rooms/${room}/state.json`
    last = await oneJoin(browser, room, stateUrl)
    if (last.wiped) reds++
    console.log(
      `run ${i + 1}/${LOOPS} build=${last.build} wiped=${last.wiped} azat=${last.azatScore} r=${last.rBefore}->${last.rAfter} [${last.scores}]`,
    )
  }

  await browser.close()

  const bugRate = reds / LOOPS
  console.log('RED_RATE', reds + '/' + LOOPS, '(' + bugRate + ')')

  if (EXPECT === 'red') {
    if (reds > 0) {
      console.log('LOOP RED (bug present as expected)')
      process.exit(0)
    }
    console.log('LOOP unexpected GREEN on EXPECT=red')
    process.exit(1)
  }

  if (reds > 0) {
    console.log('LOOP RED — scores wiped by new-browser join')
    process.exit(1)
  }
  console.log('LOOP GREEN — scores survived new-browser join')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
