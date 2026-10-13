import { chromium } from 'playwright'
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

async function scoreCurrent(page) {
  const banditBtn = page.locator('#banditBtn')
  if (await banditBtn.count()) {
    const hidden = await banditBtn.evaluate((el) => el.hidden)
    if (!hidden && !(await banditBtn.isDisabled())) {
      await banditBtn.click()
      await page.waitForTimeout(3200)
      await page.waitForFunction(() => {
        const actions = document.getElementById('scoreActions')
        return actions && !actions.hidden
      }, null, { timeout: 8000 }).catch(() => {})
    }
  }
  const done = page.locator('#doneBtn')
  await done.waitFor({ state: 'visible', timeout: 8000 })
  await done.click()
  await page.waitForTimeout(1200)
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath(),
  })
  const page = await (
    await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
  ).newPage()
  page.on('dialog', (d) => d.accept())

  const pageUrl = roomUrl(BASE, 'qa-handoff-' + Date.now())
  console.log('url', pageUrl)
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(page)
  let q = await gameQuery(page)
  console.log('build:', q.build)
  const buildNum = Number((String(q.build).match(/build\s+(\d+)/i) || [])[1] || 0)
  if (buildNum < 5) {
    console.log('FAIL | need build >= 5, got', q.build)
    await browser.close()
    process.exit(1)
  }

  await resetGame(page)
  await ensurePlayers(page)
  await page.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await page.waitForTimeout(300)

  await page.click('#spinBtn')
  await waitSpinSettled(page)
  await page.waitForTimeout(500)
  q = await gameQuery(page)
  console.log('spin1 owner:', q.turnOwnerName)
  await scoreCurrent(page)
  q = await gameQuery(page)
  console.log('after score1 owner:', q.turnOwnerName)
  const handoffOk = /Alexander/i.test(q.turnOwnerName || '')
  console.log(handoffOk ? 'PASS | handoff to Alexander' : 'FAIL | handoff not visible', q.turnOwnerName)

  await page.click('#spinBtn')
  await page.waitForTimeout(900)
  q = await gameQuery(page)
  console.log('spin2 owner:', q.turnOwnerName)
  const lockedAlexander = /Alexander/i.test(q.turnOwnerName || '')
  console.log(
    lockedAlexander ? 'PASS | second spin locked to Alexander' : 'FAIL | second spin not Alexander',
  )
  await waitSpinSettled(page)
  await scoreCurrent(page)
  q = await gameQuery(page)
  console.log('hist0:', q.history[0])
  console.log('hist1:', q.history[1])
  const secondToAlexander = /Alexander/i.test((q.history[0] && q.history[0].who) || '')
  console.log(secondToAlexander ? 'PASS | second score to Alexander' : 'FAIL | second score wrong person')

  await page.screenshot({ path: '/opt/cursor/artifacts/qa-turn-handoff.png', fullPage: true })
  await browser.close()
  process.exit(handoffOk && lockedAlexander && secondToAlexander ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
