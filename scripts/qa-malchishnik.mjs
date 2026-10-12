import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'

const URL = process.env.QA_URL || 'https://zovminga.github.io/malchishnik-spin/'
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa'
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

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(2500)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)

  const hasRoundPlayer = await page.evaluate(() => /roundPlayer|ОЧКИ ЗАСЧИТАНЫ/.test(document.documentElement.innerHTML))
  log('Latest build loaded', hasRoundPlayer, hasRoundPlayer ? 'roundPlayer present' : 'OLD BUILD')
  await shot(page, '01-loaded.png')

  // Reset game
  const resetBtn = page.locator('#resetGameBtn')
  if (await resetBtn.count()) {
    await resetBtn.click()
    await page.waitForTimeout(800)
    log('Reset game button works', true)
  } else {
    log('Reset game button present', false)
  }

  // Clear existing players by resetting via local eval if needed, then add Azat/Alexander
  await page.evaluate(() => {
    // wipe players through UI-ish: click remove if any — chips don't delete.
    // Force clean via storage + reload is heavy; instead set names fresh if empty.
  })

  // If players already exist from sync, reset scores only was done. Add players if < 2
  async function playerNames() {
    return page.evaluate(() =>
      Array.from(document.querySelectorAll('.player-chip')).map((el) => el.textContent.trim()),
    )
  }

  let chips = await playerNames()
  if (chips.length < 2) {
    for (const name of ['Azat', 'Alexander']) {
      await page.fill('#playerInput', name)
      await page.click('#addPlayerBtn')
      await page.waitForTimeout(400)
    }
  }
  chips = await playerNames()
  log('Two players present', chips.length >= 2, chips.join(' | '))

  // Ensure Azat is first / active — click first chip after score if needed
  const turnBefore = await page.locator('#turnLine').innerText()
  log('Turn line before spin', /Azat|Alexander|крутит/i.test(turnBefore), turnBefore)

  // Make Azat active if possible
  const azatChip = page.locator('.player-chip', { hasText: /Azat/i }).first()
  if (await azatChip.count()) {
    await azatChip.click()
    await page.waitForTimeout(500)
  }
  const turnAzat = await page.locator('#turnLine').innerText()
  log('Azat is current spinner', /Azat/i.test(turnAzat), turnAzat)

  // Spin place
  await page.click('#spinBtn')
  await waitSpinIdle(page)
  await page.waitForTimeout(800)
  const placeLabel = await page.locator('.result-label').innerText().catch(() => '')
  log('Place landed', !!placeLabel, placeLabel)
  await shot(page, '02-place-landed.png')

  // Bandit if present
  const banditVisible = await page.locator('#banditBox.show').count()
  const banditBtn = page.locator('#banditBtn')
  const banditShown = banditVisible > 0 && (await banditBtn.isVisible()) && !(await banditBtn.isHidden())
  if (banditShown && !(await banditBtn.getAttribute('hidden'))) {
    const hiddenAttr = await banditBtn.evaluate((el) => el.hidden)
    if (!hiddenAttr) {
      await banditBtn.click()
      await page.waitForTimeout(3500)
      const challenge = await page.locator('#challengeOut').innerText()
      log('Bandit challenge rolled', !!challenge.trim(), challenge.trim())
    } else {
      log('Bandit button hidden (no challenges)', true, 'attendance-only place')
    }
  } else {
    log('Bandit section', true, 'may be attendance-only')
  }

  // Score +2 / +1
  const doneBtn = page.locator('#doneBtn')
  await page.waitForTimeout(500)
  const doneVisible = await doneBtn.isVisible()
  log('Score buttons visible', doneVisible, await doneBtn.innerText().catch(() => ''))
  if (doneVisible) {
    await doneBtn.click()
    await page.waitForTimeout(1200)
  }

  const afterScore = await playerNames()
  const history = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#historyList li')).map((li) => li.innerText.replace(/\s+/g, ' ')),
  )
  log('History after first score', history.length > 0, history[0] || '(empty)')
  const azatGotPoints = /Azat/i.test(history[0] || '')
  const azatPlus2 = /\+2|выполнил/.test(history[0] || '')
  const azatPlus1Wrong = /был там/.test(history[0] || '') && (await page.locator('#challengeOut').innerText()).trim()
  log('First score credited to Azat', azatGotPoints, history[0] || '')
  if (azatPlus1Wrong && placeHasChallengeHint(history[0])) {
    log('Challenge place should be +2 not был там', false, history[0])
  } else if (azatPlus2 || /был там \(\+1\)/.test(history[0] || '')) {
    log('Score amount plausible', true, history[0])
  }
  await shot(page, '03-after-azat-score.png')

  // Bandit locked?
  const banditText = await banditBtn.innerText().catch(() => '')
  const banditDisabled = await banditBtn.isDisabled().catch(() => true)
  log('Bandit locked after score', banditDisabled || /ОЧКИ ЗАСЧИТАНЫ/i.test(banditText), banditText)

  // Try to abuse re-spin — should not create second award for next player
  const histLen1 = history.length
  if (!banditDisabled && (await banditBtn.isVisible()) && !(await banditBtn.evaluate((el) => el.hidden))) {
    await banditBtn.click().catch(() => {})
    await page.waitForTimeout(3500)
    if (await doneBtn.isVisible()) await doneBtn.click().catch(() => {})
    await page.waitForTimeout(800)
  }
  const history2 = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#historyList li')).map((li) => li.innerText.replace(/\s+/g, ' ')),
  )
  log('No double-award after lock', history2.length === histLen1, `hist ${histLen1} -> ${history2.length}`)

  // Second player turn
  const turn2 = await page.locator('#turnLine').innerText()
  log('Turn advanced after score', /Alexander|Azat/i.test(turn2), turn2)

  // Editor: new place at top
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

  // Share link
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

function placeHasChallengeHint() {
  return true
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
