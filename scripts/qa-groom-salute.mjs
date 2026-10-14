/**
 * Single-client Groom Salute on JACKPOT / spin-settle.
 * Seam: window.Malchishnik.query + sticker nodes in #fx.
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
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa-groom-salute'
fs.mkdirSync(OUT, { recursive: true })

const report = []
function log(step, ok, detail) {
  const line = `${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`
  report.push(line)
  console.log(line)
}

async function shot(page, name) {
  const p = path.join(OUT, name)
  await page.screenshot({ path: p, fullPage: true })
  return p
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath(),
    args: ['--disable-dev-shm-usage', '--window-size=420,900'],
  })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
  })
  const page = await context.newPage()
  page.on('dialog', async (d) => {
    await d.accept()
  })

  await page.goto(roomUrl(BASE, 'qa-groom-salute-' + Date.now()), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await waitForGame(page)
  await resetGame(page)
  await ensurePlayers(page)
  await shot(page, '01-ready.png')

  const before = await gameQuery(page)
  const firesBefore = Number(before.groomSaluteFires || 0)
  log(
    'Salute signal fields on Malchishnik.query',
    typeof before.groomSaluteActive === 'boolean' && typeof before.groomSaluteFires === 'number',
    `active=${before.groomSaluteActive} fires=${before.groomSaluteFires}`,
  )
  log('Salute idle before spin', before.groomSaluteActive === false, String(before.groomSaluteActive))

  await page.click('#spinBtn')
  // Mid-spin: salute must not fire while the wheel is still turning.
  await page.waitForTimeout(800)
  const mid = await gameQuery(page)
  log(
    'No Groom Salute during spin',
    mid.spinning === true && mid.groomSaluteActive === false && Number(mid.groomSaluteFires || 0) === firesBefore,
    `spinning=${mid.spinning} active=${mid.groomSaluteActive} fires=${mid.groomSaluteFires}`,
  )

  // Capture sticker presence during the short JACKPOT window (before ~1s cleanup).
  await page.evaluate(() => {
    window.__groomSaluteSnap = null
  })
  const saluteSeen = page.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      const stickers = Array.from(document.querySelectorAll('#fx .groom-sticker'))
      const kinds = [...new Set(stickers.map((el) => el.getAttribute('data-sticker') || ''))]
      const sparks = document.querySelectorAll('#fx .spark').length
      const ok =
        q.groomSaluteActive === true &&
        Number(q.groomSaluteFires || 0) > 0 &&
        stickers.length >= 12 &&
        stickers.length <= 20 &&
        kinds.includes('football') &&
        kinds.includes('zvyrk') &&
        kinds.includes('jesus')
      if (!ok) return false
      window.__groomSaluteSnap = {
        fires: q.groomSaluteFires,
        count: stickers.length,
        kinds,
        sparks,
      }
      return true
    },
    null,
    { timeout: 20000 },
  )

  const jackpotFlash = page.waitForFunction(
    () => document.getElementById('page')?.classList.contains('flash'),
    null,
    { timeout: 20000 },
  )

  await Promise.all([waitSpinSettled(page), saluteSeen, jackpotFlash])
  await shot(page, '02-jackpot-salute.png')

  const stickerInfo = (await page.evaluate(() => window.__groomSaluteSnap)) || {
    count: 0,
    kinds: [],
    sparks: -1,
    fires: 0,
  }
  log(
    'Groom Salute fired on JACKPOT settle',
    stickerInfo.fires === firesBefore + 1,
    `fires ${firesBefore} -> ${stickerInfo.fires}`,
  )
  log(
    'Sticker burst mix and count',
    stickerInfo.count >= 12 &&
      stickerInfo.count <= 20 &&
      ['football', 'zvyrk', 'jesus'].every((k) => stickerInfo.kinds.includes(k)),
    `${stickerInfo.count} pcs kinds=${stickerInfo.kinds.join(',')}`,
  )
  log(
    'JACKPOT banner still used (flash class)',
    true,
    'page.flash observed during settle',
  )
  log(
    'Sticker burst is main confetti (no full spark stack)',
    stickerInfo.sparks === 0 || stickerInfo.sparks < 8,
    `sparks=${stickerInfo.sparks}`,
  )

  // ~1s lifetime then nodes cleaned up; salute becomes inactive.
  await page.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      const left = document.querySelectorAll('#fx .groom-sticker').length
      return q.groomSaluteActive === false && left === 0
    },
    null,
    { timeout: 5000 },
  )
  const after = await gameQuery(page)
  log(
    'Salute cleaned up after ~1s',
    after.groomSaluteActive === false && after.groomSaluteFires === firesBefore + 1,
    `active=${after.groomSaluteActive} fires=${after.groomSaluteFires}`,
  )
  await shot(page, '03-after-cleanup.png')

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
