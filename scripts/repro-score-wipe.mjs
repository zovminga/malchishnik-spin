/**
 * Feedback loop for: "opened link on a new/phone browser → shared scores wiped".
 *
 * Usage:
 *   node scripts/repro-score-wipe.mjs              # test live Pages (expect GREEN if fixed)
 *   BASE=http://127.0.0.1:8765 node scripts/repro-score-wipe.mjs
 *   EXPECT=red node scripts/repro-score-wipe.mjs   # fail if scores survive (for old builds)
 *
 * Exit 0 = scores survived (GREEN / bug absent)
 * Exit 1 = scores wiped (RED / bug present)
 */
import { chromium } from 'playwright'
import fs from 'fs'

const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const BASE = (process.env.BASE || 'https://zovminga.github.io/malchishnik-spin/').replace(/\/?$/, '/')
const EXPECT = (process.env.EXPECT || 'green').toLowerCase() // green = want survive; red = want wipe
const ROOM = 'diag-wipe-' + Date.now()
const STATE_URL = `${DB}/rooms/${ROOM}/state.json`

const rich = {
  players: [
    { name: 'Azat', score: 5 },
    { name: 'Alexander', score: 3 },
  ],
  activePlayer: 0,
  history: [{ who: 'Azat', place: 'БАР', note: 'выполнил (+2)', color: '#1a6bff' }],
  destinations: [
    { id: 'bar', label: 'БАР', tagline: 'x', color: '#1a6bff', text: '#fff' },
    { id: 'casino', label: 'КАЗИНО', tagline: 'y', color: '#ff003c', text: '#fff' },
  ],
  challenges: { bar: ['тест'], casino: [] },
  round: null,
  updatedAt: 1000,
  updatedBy: 'seed',
}

async function putState(obj) {
  const res = await fetch(STATE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
  if (!res.ok) throw new Error('PUT failed ' + res.status)
}

async function getState() {
  const res = await fetch(STATE_URL)
  if (!res.ok) throw new Error('GET failed ' + res.status)
  return res.json()
}

function richness(s) {
  if (!s) return 0
  const scoreSum = (s.players || []).reduce((a, p) => a + (Number(p.score) || 0), 0)
  return (s.history || []).length * 100 + (s.players || []).length * 10 + scoreSum
}

async function main() {
  console.log('ROOM', ROOM)
  console.log('BASE', BASE)
  console.log('EXPECT', EXPECT)

  await putState(rich)
  const before = await getState()
  console.log('BEFORE richness', richness(before), 'scores', (before.players || []).map((p) => p.score))

  const browser = await chromium.launch({
    headless: true,
    executablePath: '/usr/bin/google-chrome-stable',
  })
  // Fresh profile = "opened on phone for the first time"
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })
  const page = await context.newPage()
  page.on('dialog', (d) => d.accept())

  const url = `${BASE}index.html?room=${ROOM}&t=${Date.now()}`
  console.log('OPEN', url)
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(4500)

  const build = await page.locator('#buildTag').innerText().catch(() => '?')
  console.log('BUILD', build)

  const after = await getState()
  const scores = (after.players || []).map((p) => `${p.name}:${p.score}`).join(', ')
  const rBefore = richness(before)
  const rAfter = richness(after)
  const wiped = rAfter < rBefore && (after.history || []).length === 0
  const azatScore = ((after.players || []).find((p) => p.name === 'Azat') || {}).score

  console.log('AFTER richness', rAfter, 'scores', scores)
  console.log('WIPED?', wiped, 'azatScore', azatScore)

  fs.mkdirSync('/opt/cursor/artifacts', { recursive: true })
  await page.screenshot({ path: '/opt/cursor/artifacts/diag-score-wipe.png', fullPage: true })
  await browser.close()

  // cleanup test room
  await fetch(STATE_URL, { method: 'DELETE' }).catch(() => {})

  const bugPresent = wiped || azatScore !== 5
  if (EXPECT === 'red') {
    if (bugPresent) {
      console.log('LOOP RED (as expected for buggy build)')
      process.exit(0)
    }
    console.log('LOOP unexpected GREEN on EXPECT=red')
    process.exit(1)
  }

  // EXPECT=green: bug must be absent
  if (bugPresent) {
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
