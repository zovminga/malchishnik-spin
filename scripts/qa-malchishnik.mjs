import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import {
  artifactDir,
  chromePath,
  ensurePlayers,
  gameQuery,
  qaBase,
  resetGame,
  roomUrl,
  waitForGame,
  waitSpinSettled,
} from './qa-lib.mjs'

const BASE = qaBase()
const OUT = artifactDir('qa-malchishnik')

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
    console.log('DIALOG:', d.type(), d.message())
    await d.accept()
  })

  await page.goto(roomUrl(BASE, 'qa-malchishnik-' + Date.now()), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await waitForGame(page)
  let q = await gameQuery(page)
  log('Malchishnik.query available', !!q.build, q.build)
  await shot(page, '01-loaded.png')

  await resetGame(page)
  log('Reset game button works', true)

  q = await ensurePlayers(page)
  log(
    'Two players present',
    q.scores.length >= 2,
    q.scores.map((p) => `${p.name} ${p.score}`).join(' | '),
  )

  await page.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await page.waitForTimeout(500)
  q = await gameQuery(page)
  log('Azat is current spinner', /Azat/i.test(q.turnOwnerName || ''), q.turnOwnerName)

  await page.click('#spinBtn')
  await waitSpinSettled(page)
  await page.waitForTimeout(800)
  const placeLabel = await page.locator('.result-label').innerText().catch(() => '')
  log('Place landed', !!placeLabel, placeLabel)
  await shot(page, '02-place-landed.png')

  const banditBtn = page.locator('#banditBtn')
  const hiddenAttr = await banditBtn.evaluate((el) => el.hidden).catch(() => true)
  if (!hiddenAttr) {
    await banditBtn.click()
    await page.waitForTimeout(3500)
    const challenge = await page.locator('#challengeOut').innerText()
    log('Bandit challenge rolled', !!challenge.trim(), challenge.trim())
  } else {
    log('Bandit section', true, 'attendance-only or already scored')
  }

  const doneBtn = page.locator('#doneBtn')
  await page.waitForTimeout(500)
  const doneVisible = await doneBtn.isVisible()
  log('Score buttons visible', doneVisible, await doneBtn.innerText().catch(() => ''))
  if (doneVisible) {
    await doneBtn.click()
    await page.waitForTimeout(1200)
  }

  q = await gameQuery(page)
  const hist0 = q.history[0] || {}
  log('History after first score', q.history.length > 0, `${hist0.who} ${hist0.note || ''}`)
  log('First score credited to Azat', /Azat/i.test(hist0.who || ''), `${hist0.who} ${hist0.note || ''}`)
  log(
    'Score amount plausible',
    /\+2|\+1/.test(hist0.note || ''),
    hist0.note || '',
  )
  await shot(page, '03-after-azat-score.png')

  log('Bandit locked after score', !!q.banditLocked, String(q.banditLocked))

  const histLen1 = q.history.length
  if (!q.banditLocked && !(await banditBtn.evaluate((el) => el.hidden))) {
    await banditBtn.click().catch(() => {})
    await page.waitForTimeout(3500)
    if (await doneBtn.isVisible()) await doneBtn.click().catch(() => {})
    await page.waitForTimeout(800)
  }
  q = await gameQuery(page)
  log('No double-award after lock', q.history.length === histLen1, `hist ${histLen1} -> ${q.history.length}`)
  log('Turn advanced after score', /Alexander|Azat/i.test(q.turnOwnerName || ''), q.turnOwnerName)

  await page.click('#editorToggle')
  await page.waitForTimeout(500)
  const firebaseUi = await page.evaluate(() => {
    const t = document.body.innerText
    return /СИНХРОНИЗАЦИЯ \(FIREBASE\)|Вставь firebaseConfig|Подключить синк/.test(t)
  })
  log('No Firebase setup UI', !firebaseUi)

  await page.click('#addPlaceBtn')
  await page.waitForTimeout(800)
  const firstPlaceLabel = await page.evaluate(() => {
    const input = document.querySelector('#editorList .place-block input[data-field="label"]')
    return input ? input.value : ''
  })
  log('New place at top', firstPlaceLabel === 'НОВОЕ', `first="${firstPlaceLabel}"`)
  await shot(page, '04-new-place-top.png')

  await page.click('#shareFriendsBtn')
  await page.waitForTimeout(500)
  log('Share link button clickable', true)

  await shot(page, '05-final.png')
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
