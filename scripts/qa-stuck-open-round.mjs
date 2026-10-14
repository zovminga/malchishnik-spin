/**
 * Fresh join into a Room that already has an open Round with a Place
 * must restore bandit/score UI — not leave spin on «СНАЧАЛА ОЧКИ» with «Жми кнопку».
 */
import { chromium } from 'playwright'
import { chromePath, roomUrl, waitForGame, gameQuery } from './qa-lib.mjs'

const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const BASE = (process.env.QA_URL || process.env.BASE || 'http://127.0.0.1:8765/').replace(
  /\/?$/,
  '/',
)

async function putState(url, obj) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
  if (!res.ok) throw new Error('PUT failed ' + res.status)
}

async function main() {
  const room = 'qa-stuck-open-' + Date.now()
  const stateUrl = `${DB}/rooms/${room}/state.json`
  const seed = {
    destinations: [
      {
        id: 'bar',
        label: 'БАР',
        tagline: 'x',
        color: '#1a6bff',
        text: '#fff',
      },
    ],
    challenges: { bar: [] },
    players: [
      { name: 'Azat', score: 7 },
      { name: 'Alexander', score: 4 },
    ],
    activePlayer: 0,
    round: {
      owner: 0,
      placeId: 'bar',
      placeLabel: 'БАР',
      placeColor: '#1a6bff',
      challenge: null,
      scored: false,
      token: 'stuck1',
    },
    history: [{ who: 'Azat', place: 'БАР', note: 'старый лог (+1)', color: '#1a6bff' }],
    updatedAt: Date.now(),
    updatedBy: 'seed',
  }
  await putState(stateUrl, seed)

  const browser = await chromium.launch({
    executablePath: chromePath(),
    headless: true,
  })
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('dialog', (d) => d.accept())
  await page.goto(roomUrl(BASE, room), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(page)
  await page.waitForTimeout(2500)

  const q = await gameQuery(page)
  const spinLabel = await page.locator('#spinBtn').innerText()
  const scoreVisible = await page.locator('#scoreActions').evaluate((el) => {
    return !el.hidden && !el.hasAttribute('hidden')
  })
  const resultText = await page.locator('#result').innerText()
  const placeholderOnly = /жми кнопку/i.test(resultText) && !/бар/i.test(resultText)

  let failures = 0
  function pass(name, ok, detail) {
    console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? ' — ' + detail : ''))
    if (!ok) failures++
  }

  pass('build present', /build\s+\d+/i.test(q.build || ''), q.build)
  pass('round still open', !!q.roundOpen, 'roundOpen=' + q.roundOpen)
  pass(
    'spin blocked while open Round',
    q.spinAvailable === false && /очки|крутит/i.test(spinLabel),
    spinLabel,
  )
  pass('score actions restored', scoreVisible || q.scoreActionsVisible === true, 'visible=' + scoreVisible)
  pass('result shows Place not empty placeholder', !placeholderOnly, resultText.replace(/\s+/g, ' ').slice(0, 80))

  await browser.close()
  await fetch(stateUrl, { method: 'DELETE' }).catch(() => {})

  console.log('\n=== SUMMARY ===\nfailures:', failures)
  if (failures) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
