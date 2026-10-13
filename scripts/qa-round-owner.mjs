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

const BASE = process.env.QA_URL || 'https://zovminga.github.io/malchishnik-spin/'
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa'
fs.mkdirSync(OUT, { recursive: true })

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath(),
    args: ['--disable-dev-shm-usage'],
  })
  const page = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage()
  page.on('dialog', (d) => d.accept())

  const url = roomUrl(BASE, 'qa-round-owner-' + Date.now())
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(page)
  let q = await gameQuery(page)
  const buildOk = /build\s+\d+/i.test(q.build || '')
  console.log(buildOk ? 'PASS | new build' : 'FAIL | old build', q.build)
  if (!buildOk) {
    await browser.close()
    process.exit(1)
  }

  await resetGame(page)
  await ensurePlayers(page)

  // Make Alexander active, start spin, try to click Azat mid-spin
  await page.locator('.player-chip', { hasText: /Alexander/i }).first().click()
  await page.waitForTimeout(400)
  q = await gameQuery(page)
  console.log('before spin: owner=', q.turnOwnerName)

  await page.click('#spinBtn')
  await page.waitForTimeout(800)
  await page.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await page.waitForTimeout(400)
  q = await gameQuery(page)
  const lockedToAlexander = /Alexander/i.test(q.turnOwnerName || '')
  console.log(
    lockedToAlexander ? 'PASS | owner locked during spin' : 'FAIL | owner changed during spin',
    q.turnOwnerName,
  )

  await waitSpinSettled(page)
  await page.waitForTimeout(600)

  const banditBtn = page.locator('#banditBtn')
  if (!(await banditBtn.evaluate((el) => el.hidden))) {
    await banditBtn.click()
    await page.waitForTimeout(3500)
    await page.click('#doneBtn')
  } else if (await page.locator('#doneBtn').isVisible()) {
    await page.click('#doneBtn')
  }
  await page.waitForTimeout(1000)

  q = await gameQuery(page)
  const hist0 = q.history[0] || {}
  console.log('hist:', hist0.who, hist0.note)
  const ok = /Alexander/i.test(hist0.who || '')
  console.log(ok ? 'PASS | points to Alexander (spin owner)' : 'FAIL | points not to Alexander')

  await page.screenshot({ path: OUT + '/round-owner.png', fullPage: true })
  await browser.close()
  process.exit(lockedToAlexander && ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
