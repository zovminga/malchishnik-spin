import { chromium } from 'playwright'
import fs from 'fs'

const URL = process.env.QA_URL || 'https://zovminga.github.io/malchishnik-spin/'
const OUT = '/opt/cursor/artifacts/qa'
fs.mkdirSync(OUT, { recursive: true })

async function waitSpinIdle(page) {
  await page.waitForFunction(() => {
    const btn = document.getElementById('spinBtn')
    return btn && !btn.disabled && /КРУТИТЬ МЕСТО/i.test(btn.textContent || '')
  }, null, { timeout: 20000 })
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome-stable',
    args: ['--disable-dev-shm-usage'],
  })
  const page = await (await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  })).newPage()
  page.on('dialog', (d) => d.accept())

  // bust cache
  await page.goto(URL + '?t=' + Date.now(), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  const hasRound = await page.evaluate(() => /roundIsOpen|Раунд:/.test(document.documentElement.innerHTML))
  console.log(hasRound ? 'PASS | new build' : 'FAIL | old build')
  if (!hasRound) {
    await browser.close()
    process.exit(1)
  }

  await page.click('#resetGameBtn')
  await page.waitForTimeout(800)

  let chips = await page.locator('.player-chip').count()
  if (chips < 2) {
    for (const n of ['Azat', 'Alexander']) {
      await page.fill('#playerInput', n)
      await page.click('#addPlayerBtn')
      await page.waitForTimeout(300)
    }
  }

  // Make Alexander active, start spin, try to click Azat mid-spin (old bug)
  await page.locator('.player-chip', { hasText: /Alexander/i }).first().click()
  await page.waitForTimeout(400)
  let turn = await page.locator('#turnLine').innerText()
  console.log('before spin:', turn)

  await page.click('#spinBtn')
  await page.waitForTimeout(800)
  // try steal to Azat during spin
  await page.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await page.waitForTimeout(400)
  turn = await page.locator('#turnLine').innerText()
  console.log('during spin:', turn)
  const lockedToAlexander = /Alexander/i.test(turn)
  console.log(lockedToAlexander ? 'PASS | owner locked during spin' : 'FAIL | owner changed during spin')

  await waitSpinIdle(page)
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

  const hist = await page.evaluate(() =>
    (document.querySelector('#historyList li') || {}).innerText || '',
  )
  console.log('hist:', hist.replace(/\s+/g, ' '))
  const ok = /Alexander/i.test(hist)
  console.log(ok ? 'PASS | points to Alexander (spin owner)' : 'FAIL | points not to Alexander')

  await page.screenshot({ path: OUT + '/round-owner.png', fullPage: true })
  await browser.close()
  process.exit(lockedToAlexander && ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
