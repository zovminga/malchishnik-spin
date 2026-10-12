import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const URL = process.env.QA_URL || 'https://zovminga.github.io/malchishnik-spin/'
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa'
fs.mkdirSync(OUT, { recursive: true })

async function waitSpinIdle(page) {
  await page.waitForFunction(() => {
    const btn = document.getElementById('spinBtn')
    return btn && !btn.disabled && /КРУТИТЬ МЕСТО/i.test(btn.textContent || '')
  }, null, { timeout: 20000 })
}

async function scores(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('.player-chip')).map((el) => el.textContent.trim()),
  )
}

async function history(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#historyList li')).map((li) => li.innerText.replace(/\s+/g, ' ')),
  )
}

async function main() {
  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome-stable',
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
  page.on('dialog', async (d) => d.accept())

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2000)
  await page.click('#resetGameBtn')
  await page.waitForTimeout(600)

  // Ensure Azat / Alexander
  let chips = await scores(page)
  if (chips.length < 2) {
    for (const name of ['Azat', 'Alexander']) {
      await page.fill('#playerInput', name)
      await page.click('#addPlayerBtn')
      await page.waitForTimeout(300)
    }
  }
  await page.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await page.waitForTimeout(400)

  let foundChallenge = false
  let place = ''
  let challenge = ''

  for (let attempt = 1; attempt <= 12; attempt++) {
    await page.click('#spinBtn')
    await waitSpinIdle(page)
    await page.waitForTimeout(600)
    place = await page.locator('.result-label').innerText()
    const banditBtn = page.locator('#banditBtn')
    const canBandit =
      (await page.locator('#banditBox.show').count()) > 0 &&
      !(await banditBtn.evaluate((el) => el.hidden))

    console.log(`attempt ${attempt}: ${place} bandit=${canBandit}`)
    if (canBandit) {
      await banditBtn.click()
      await page.waitForTimeout(3500)
      challenge = (await page.locator('#challengeOut').innerText()).trim()
      if (challenge) {
        foundChallenge = true
        break
      }
    }
  }

  if (!foundChallenge) {
    console.log('FAIL | Could not land a challenge place in 12 spins')
    await page.screenshot({ path: path.join(OUT, 'challenge-miss.png'), fullPage: true })
    await browser.close()
    process.exit(1)
  }

  const before = await scores(page)
  console.log('BEFORE', before.join(' | '), 'place=', place, 'challenge=', challenge)
  await page.screenshot({ path: path.join(OUT, 'challenge-before-score.png'), fullPage: true })

  await page.click('#doneBtn')
  await page.waitForTimeout(1200)

  const after = await scores(page)
  const hist = await history(page)
  const banditText = await page.locator('#banditBtn').innerText()
  const turn = await page.locator('#turnLine').innerText()

  console.log('AFTER', after.join(' | '))
  console.log('HIST0', hist[0])
  console.log('BANDIT', banditText)
  console.log('TURN', turn)

  const passAzat =
    /Azat/i.test(hist[0] || '') &&
    /выполнил \(\+2\)/.test(hist[0] || '') &&
    !/Alexander/i.test(hist[0] || '')
  const passLock = /ОЧКИ ЗАСЧИТАНЫ/i.test(banditText)
  const passTurn = /Alexander/i.test(turn)

  // Second round for Alexander with forced challenge if possible
  await page.click('#spinBtn')
  await waitSpinIdle(page)
  await page.waitForTimeout(500)
  const banditBtn2 = page.locator('#banditBtn')
  if (!(await banditBtn2.evaluate((el) => el.hidden))) {
    await banditBtn2.click()
    await page.waitForTimeout(3500)
    await page.click('#doneBtn')
    await page.waitForTimeout(1000)
  } else if (await page.locator('#doneBtn').isVisible()) {
    await page.click('#doneBtn')
    await page.waitForTimeout(1000)
  }

  const hist2 = await history(page)
  const after2 = await scores(page)
  console.log('AFTER2', after2.join(' | '))
  console.log('HIST1', hist2[0])

  await page.screenshot({ path: path.join(OUT, 'challenge-after-two-rounds.png'), fullPage: true })

  const results = [
    ['Challenge place scored +2 to Azat', passAzat, hist[0]],
    ['Bandit locked after score', passLock, banditText],
    ['Turn -> Alexander', passTurn, turn],
    ['Second log entry exists', hist2.length >= 2, String(hist2.length)],
  ]

  let failed = 0
  for (const [name, ok, detail] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} — ${detail}`)
    if (!ok) failed++
  }

  fs.writeFileSync(
    path.join(OUT, 'scoring-report.txt'),
    results.map(([n, ok, d]) => `${ok ? 'PASS' : 'FAIL'} | ${n} — ${d}`).join('\n') + '\n',
  )
  await browser.close()
  process.exit(failed ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(2)
})
