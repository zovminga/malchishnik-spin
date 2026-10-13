import { chromium } from 'playwright'

const URL = process.env.QA_URL || 'https://zovminga.github.io/malchishnik-spin/'

async function waitSpinIdle(page) {
  await page.waitForFunction(() => {
    const btn = document.getElementById('spinBtn')
    return btn && !btn.disabled && /КРУТИТЬ/i.test(btn.textContent || '')
  }, null, { timeout: 20000 })
}

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
    headless: false,
    executablePath: '/usr/bin/google-chrome-stable',
  })
  const page = await (
    await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  ).newPage()
  page.on('dialog', (d) => d.accept())

  const room = 'qa-handoff-' + Date.now()
  const pageUrl = URL.split('?')[0] + '?room=' + room + '&t=' + Date.now()
  console.log('url', pageUrl)
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  const build = await page.locator('#buildTag').innerText().catch(() => '')
  console.log('build:', build)
  const buildNum = Number((build.match(/build\s+(\d+)/i) || [])[1] || 0)
  if (buildNum < 5) {
    console.log('FAIL | need build >= 5, got', build)
    await browser.close()
    process.exit(1)
  }

  await page.click('#resetGameBtn')
  await page.waitForTimeout(600)
  if ((await page.locator('.player-chip').count()) < 2) {
    for (const n of ['Azat', 'Alexander']) {
      await page.fill('#playerInput', n)
      await page.click('#addPlayerBtn')
      await page.waitForTimeout(250)
    }
  }
  await page.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await page.waitForTimeout(300)

  // Spin 1 as Azat
  await page.click('#spinBtn')
  await waitSpinIdle(page)
  await page.waitForTimeout(500)
  let turn = await page.locator('#turnLine').innerText()
  console.log('spin1 turn:', turn)
  await scoreCurrent(page)
  turn = await page.locator('#turnLine').innerText()
  const result = await page.locator('#result').innerText()
  console.log('after score1 turn:', turn)
  console.log('after score1 result:', result.replace(/\s+/g, ' '))
  const handoffOk = /Alexander/i.test(turn) || /Alexander/i.test(result)
  console.log(handoffOk ? 'PASS | handoff to Alexander visible' : 'FAIL | handoff not visible')

  // Spin 2 — must be Alexander's round
  await page.click('#spinBtn')
  await page.waitForTimeout(900)
  turn = await page.locator('#turnLine').innerText()
  console.log('spin2 turn:', turn)
  const lockedAlexander = /Alexander/i.test(turn)
  console.log(lockedAlexander ? 'PASS | second spin locked to Alexander' : 'FAIL | second spin not Alexander')
  await waitSpinIdle(page)
  await scoreCurrent(page)
  const hist = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#historyList li')).map((li) => li.innerText.replace(/\s+/g, ' ')),
  )
  console.log('hist0:', hist[0])
  console.log('hist1:', hist[1])
  const secondToAlexander = /Alexander/i.test(hist[0] || '')
  console.log(secondToAlexander ? 'PASS | second score to Alexander' : 'FAIL | second score wrong person')

  await page.screenshot({ path: '/opt/cursor/artifacts/qa-turn-handoff.png', fullPage: true })
  await browser.close()
  process.exit(handoffOk && lockedAlexander && secondToAlexander ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
