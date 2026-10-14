/**
 * Two-client Peer Groom Salute: watcher sees salute for shared JACKPOT / spin-settle.
 * Seam: window.Malchishnik.query + Playwright multi-context (same Room).
 * Prefers existing Round placeId sync — no separate salute document.
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
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
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa-groom-salute-peers'
fs.mkdirSync(OUT, { recursive: true })

const report = []
function log(step, ok, detail) {
  const line = `${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`
  report.push(line)
  console.log(line)
}

async function newPage(browser) {
  const page = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      locale: 'ru-RU',
    })
  ).newPage()
  page.on('dialog', async (d) => {
    await d.accept()
  })
  return page
}

async function waitPeerSalute(page, firesBefore, timeout = 25000) {
  await page.evaluate(() => {
    window.__peerSaluteSnap = null
  })
  await page.waitForFunction(
    (before) => {
      const q = window.Malchishnik.query()
      const stickers = Array.from(document.querySelectorAll('#fx .groom-sticker'))
      const kinds = [...new Set(stickers.map((el) => el.getAttribute('data-sticker') || ''))]
      const ok =
        q.groomSaluteActive === true &&
        Number(q.groomSaluteFires || 0) > before &&
        stickers.length >= 12 &&
        stickers.length <= 20 &&
        kinds.includes('football') &&
        kinds.includes('zvyrk') &&
        kinds.includes('jesus')
      if (!ok) return false
      window.__peerSaluteSnap = {
        fires: q.groomSaluteFires,
        count: stickers.length,
        kinds,
        place: q.placeLabel || q.roundPlaceLabel || null,
        roundOpen: q.roundOpen,
      }
      return true
    },
    firesBefore,
    { timeout },
  )
  return page.evaluate(() => window.__peerSaluteSnap)
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath(),
    args: ['--disable-dev-shm-usage', '--window-size=420,900'],
  })
  const pageA = await newPage(browser)
  const pageB = await newPage(browser)

  const url = roomUrl(BASE, 'qa-groom-salute-peers-' + Date.now())
  console.log('url', url)

  await Promise.all([
    pageA.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
    pageB.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }),
  ])
  await Promise.all([waitForGame(pageA), waitForGame(pageB)])

  await resetGame(pageA)
  await pageA.waitForTimeout(800)
  await ensurePlayers(pageA, ['Azat', 'Alexander'])
  await pageB.waitForFunction(
    () => (window.Malchishnik.query().scores || []).length >= 2,
    null,
    { timeout: 15000 },
  )

  const beforeA = await gameQuery(pageA)
  const beforeB = await gameQuery(pageB)
  const firesA = Number(beforeA.groomSaluteFires || 0)
  const firesB = Number(beforeB.groomSaluteFires || 0)
  log(
    'Peer idle salute signals',
    beforeA.groomSaluteActive === false &&
      beforeB.groomSaluteActive === false &&
      typeof beforeB.groomSaluteFires === 'number',
    `A fires=${firesA} B fires=${firesB}`,
  )

  // Watcher arms salute wait before spinner clicks (short ~1s burst).
  const peerSaluteP = waitPeerSalute(pageB, firesB)
  const spinnerSaluteP = waitPeerSalute(pageA, firesA)

  await pageA.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await pageA.click('#spinBtn')

  const [snapA, snapB] = await Promise.all([
    spinnerSaluteP,
    peerSaluteP,
    waitSpinSettled(pageA, 25000),
    waitSpinSettled(pageB, 25000),
  ])

  await pageA.screenshot({ path: path.join(OUT, 'spinner-salute.png'), fullPage: true })
  await pageB.screenshot({ path: path.join(OUT, 'peer-salute.png'), fullPage: true })

  log(
    'Spinner Groom Salute on JACKPOT settle',
    !!snapA && snapA.fires === firesA + 1 && snapA.count >= 12,
    snapA ? `fires=${snapA.fires} count=${snapA.count}` : 'no snap',
  )
  log(
    'Second client observes Groom Salute for shared landing',
    !!snapB && snapB.fires === firesB + 1 && snapB.count >= 12,
    snapB
      ? `fires=${snapB.fires} count=${snapB.count} kinds=${(snapB.kinds || []).join(',')}`
      : 'peer never saw salute',
  )
  log(
    'Peer sticker mix includes football, Zvyrk, Jesus',
    !!snapB &&
      ['football', 'zvyrk', 'jesus'].every((k) => (snapB.kinds || []).includes(k)),
    snapB ? (snapB.kinds || []).join(',') : 'n/a',
  )

  // Both still share one open Round (ADR-0003); salute did not invent a second Room.
  const qA = await gameQuery(pageA)
  const qB = await gameQuery(pageB)
  const sameRound =
    qA.roundOpen &&
    qB.roundOpen &&
    qA.turnOwnerName &&
    qA.turnOwnerName === qB.turnOwnerName
  log(
    'Night Progress / Round Owner path unchanged (one open Round)',
    sameRound,
    `owner A=${qA.turnOwnerName} B=${qB.turnOwnerName}`,
  )

  await browser.close()
  fs.writeFileSync(path.join(OUT, 'report.txt'), report.join('\n') + '\n')
  const failed = report.filter((l) => l.startsWith('FAIL')).length
  console.log('\n=== SUMMARY ===')
  console.log(`failures: ${failed}`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
