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
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa'
fs.mkdirSync(OUT, { recursive: true })

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
  page.on('dialog', async (d) => d.accept())

  await page.goto(roomUrl(BASE, 'qa-scoring-' + Date.now()), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await waitForGame(page)
  await resetGame(page)
  await ensurePlayers(page)
  await page.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await page.waitForTimeout(400)

  let foundChallenge = false
  let place = ''
  let challenge = ''
  let roundOwner = ''

  for (let attempt = 1; attempt <= 12; attempt++) {
    await page.click('#spinBtn')
    await waitSpinSettled(page)
    await page.waitForTimeout(600)
    place = await page.locator('.result-label').innerText()
    const banditBtn = page.locator('#banditBtn')
    const canBandit =
      (await page.locator('#banditBox.show').count()) > 0 &&
      !(await banditBtn.evaluate((el) => el.hidden))

    console.log(`attempt ${attempt}: ${place} bandit=${canBandit}`)
    if (canBandit) {
      roundOwner = (await gameQuery(page)).turnOwnerName || ''
      await banditBtn.click()
      await page.waitForTimeout(3500)
      challenge = (await page.locator('#challengeOut').innerText()).trim()
      if (challenge) {
        foundChallenge = true
        break
      }
    }
    // Attendance-only Place still leaves an open Round — score it away so the next spin can run.
    const doneBtn = page.locator('#doneBtn')
    if (await doneBtn.isVisible().catch(() => false)) {
      await doneBtn.click()
      await page.waitForTimeout(900)
    }
  }

  if (!foundChallenge) {
    console.log('FAIL | Could not land a challenge place in 12 spins')
    await page.screenshot({ path: path.join(OUT, 'challenge-miss.png'), fullPage: true })
    await browser.close()
    process.exit(1)
  }

  let q = await gameQuery(page)
  roundOwner = roundOwner || q.turnOwnerName || ''
  const nextOwner = /Azat/i.test(roundOwner) ? 'Alexander' : 'Azat'
  console.log(
    'BEFORE',
    q.scores.map((p) => `${p.name} ${p.score}`).join(' | '),
    'place=',
    place,
    'challenge=',
    challenge,
    'roundOwner=',
    roundOwner,
  )
  await page.screenshot({ path: path.join(OUT, 'challenge-before-score.png'), fullPage: true })

  await page.click('#doneBtn')
  await page.waitForTimeout(1200)

  q = await gameQuery(page)
  const hist0 = q.history[0] || {}
  console.log(
    'AFTER',
    q.scores.map((p) => `${p.name} ${p.score}`).join(' | '),
  )
  console.log('HIST0', hist0.who, hist0.note, hist0.challenge)
  console.log('BANDIT_LOCKED', q.banditLocked)
  console.log('TURN', q.turnOwnerName)

  const ownerRe = new RegExp(roundOwner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const nextRe = new RegExp(nextOwner.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
  const passOwner =
    ownerRe.test(hist0.who || '') &&
    /\+2/.test(hist0.note || '') &&
    /выполнил/.test(hist0.note || '') &&
    !nextRe.test(hist0.who || '')
  const passLock = !!q.banditLocked
  const passTurn = nextRe.test(q.turnOwnerName || '')
  const detailLock = String(q.banditLocked)
  const detailTurn = q.turnOwnerName
  const detailHist0 = `${hist0.who} ${hist0.note}`

  await page.click('#spinBtn')
  await waitSpinSettled(page)
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

  q = await gameQuery(page)
  console.log(
    'AFTER2',
    q.scores.map((p) => `${p.name} ${p.score}`).join(' | '),
  )
  console.log('HIST1', (q.history[0] || {}).who, (q.history[0] || {}).note)

  await page.screenshot({ path: path.join(OUT, 'challenge-after-two-rounds.png'), fullPage: true })

  const results = [
    [`Challenge place scored +2 to ${roundOwner}`, passOwner, detailHist0],
    ['Bandit locked after score', passLock, detailLock],
    [`Turn -> ${nextOwner}`, passTurn, detailTurn],
    ['Second log entry exists', q.history.length >= 2, String(q.history.length)],
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
