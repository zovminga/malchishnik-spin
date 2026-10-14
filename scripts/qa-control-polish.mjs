/**
 * Light control polish: spin available, bandit rolling vs Challenge picked,
 * done/fail when Round open; Groom Salute must not block after it finishes.
 * Seam: window.Malchishnik.query + stable control ids (#spinBtn, #banditBtn, #doneBtn).
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
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa-control-polish'
fs.mkdirSync(OUT, { recursive: true })

const report = []
function log(step, ok, detail) {
  const line = `${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`
  report.push(line)
  console.log(line)
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: true })
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

  await page.goto(roomUrl(BASE, 'qa-control-polish-' + Date.now()), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await waitForGame(page)
  await resetGame(page)
  await ensurePlayers(page)

  let q = await gameQuery(page)
  log(
    'Control clarity fields on Malchishnik.query',
    typeof q.spinAvailable === 'boolean' && typeof q.scoreActionsVisible === 'boolean',
    `spinAvailable=${q.spinAvailable} scoreActionsVisible=${q.scoreActionsVisible}`,
  )
  log(
    'Turn Player can spin when no Round is open',
    q.spinAvailable === true && q.roundOpen === false && !(await page.locator('#spinBtn').isDisabled()),
    `spinAvailable=${q.spinAvailable} disabled=${await page.locator('#spinBtn').isDisabled()} label=${await page.locator('#spinBtn').innerText()}`,
  )
  await shot(page, '01-spin-available.png')

  // Land an open Round with a Challenge Place so bandit rolling → picked is covered.
  let usedBandit = false
  let loggedAttendanceDoneFail = false
  const banditBtn = page.locator('#banditBtn')
  for (let attempt = 1; attempt <= 12; attempt++) {
    await page.click('#spinBtn')
    await waitSpinSettled(page)
    await page.waitForTimeout(350)
    q = await gameQuery(page)
    const spinLabel = (await page.locator('#spinBtn').innerText()).trim()
    if (attempt === 1) {
      log(
        'Spin not available while Round is open',
        q.roundOpen === true &&
          q.spinAvailable === false &&
          (await page.locator('#spinBtn').isDisabled()) &&
          !/КРУТИТЬ/i.test(spinLabel),
        `roundOpen=${q.roundOpen} spinAvailable=${q.spinAvailable} label=${spinLabel}`,
      )
    }
    const canBandit =
      (await page.locator('#banditBox.show').count()) > 0 &&
      !(await banditBtn.evaluate((el) => el.hidden).catch(() => true))
    if (canBandit) {
      usedBandit = true
      const rollingPromise = page.waitForFunction(
        () => {
          const q2 = window.Malchishnik.query()
          const btn = document.getElementById('banditBtn')
          const t = (btn && btn.textContent) || ''
          return q2.banditSpinning === true && /КРУТИТСЯ|ВЫБИРАЕТ/i.test(t)
        },
        null,
        { timeout: 5000 },
      )
      await banditBtn.click()
      await rollingPromise
      q = await gameQuery(page)
      log(
        'Bandit rolling is observable while Challenge is not picked',
        q.banditSpinning === true && q.scoreActionsVisible === false,
        `banditSpinning=${q.banditSpinning} scoreActionsVisible=${q.scoreActionsVisible} label=${await banditBtn.innerText()}`,
      )
      await page.waitForFunction(
        () => {
          const q2 = window.Malchishnik.query()
          return q2.banditSpinning === false && q2.scoreActionsVisible === true
        },
        null,
        { timeout: 8000 },
      )
      q = await gameQuery(page)
      const banditLabel = (await banditBtn.innerText()).trim()
      log(
        'Challenge picked: bandit idle and done/fail visible',
        q.banditSpinning === false &&
          q.scoreActionsVisible === true &&
          (await page.locator('#doneBtn').isVisible()) &&
          (await page.locator('#failBtn').isVisible()) &&
          !/КРУТИТСЯ/i.test(banditLabel),
        `scoreActionsVisible=${q.scoreActionsVisible} bandit=${banditLabel}`,
      )
      break
    }
    // Attendance-only Place: assert done/fail once, then score away to retry for bandit.
    q = await gameQuery(page)
    if (!loggedAttendanceDoneFail) {
      loggedAttendanceDoneFail = true
      log(
        'Done/fail visible for open Round without Challenge list',
        q.roundOpen === true &&
          q.scoreActionsVisible === true &&
          (await page.locator('#doneBtn').isVisible()) &&
          (await page.locator('#failBtn').isVisible()),
        `scoreActionsVisible=${q.scoreActionsVisible}`,
      )
    }
    await page.click('#doneBtn')
    await page.waitForFunction(() => window.Malchishnik.query().roundOpen === false, null, {
      timeout: 10000,
    })
  }
  if (!usedBandit) {
    log('Bandit rolling path reached', false, 'no Challenge Place in 12 spins')
    await browser.close()
    fs.writeFileSync(path.join(OUT, 'report.txt'), report.join('\n') + '\n')
    process.exit(1)
  }
  await shot(page, '02-round-open-controls.png')

  // After Groom Salute cleanup (or idle), score controls must still accept clicks.
  await page.waitForFunction(
    () => {
      const q2 = window.Malchishnik.query()
      return q2.groomSaluteActive === false && document.querySelectorAll('#fx .groom-sticker').length === 0
    },
    null,
    { timeout: 5000 },
  )
  const fxBlocks = await page.evaluate(() => {
    const fx = document.getElementById('fx')
    if (!fx) return true
    return getComputedStyle(fx).pointerEvents === 'none'
  })
  log('Salute layer does not capture pointer events', fxBlocks === true, `pointer-events none=${fxBlocks}`)

  await page.click('#doneBtn')
  await page.waitForFunction(() => window.Malchishnik.query().roundOpen === false, null, {
    timeout: 10000,
  })
  q = await gameQuery(page)
  log(
    'After score, spin available again for next Turn Player',
    q.roundOpen === false && q.spinAvailable === true && !(await page.locator('#spinBtn').isDisabled()),
    `spinAvailable=${q.spinAvailable} label=${await page.locator('#spinBtn').innerText()}`,
  )
  await shot(page, '03-after-score.png')

  // prefers-reduced-motion: particles skipped/shortened; Round controls still usable.
  await context.close()
  const reduced = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
    reducedMotion: 'reduce',
  })
  const pageR = await reduced.newPage()
  pageR.on('dialog', async (d) => {
    await d.accept()
  })
  await pageR.goto(roomUrl(BASE, 'qa-control-polish-rm-' + Date.now()), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await waitForGame(pageR)
  await resetGame(pageR)
  await ensurePlayers(pageR)
  const firesBefore = Number((await gameQuery(pageR)).groomSaluteFires || 0)
  await pageR.click('#spinBtn')
  await waitSpinSettled(pageR)
  await pageR.waitForTimeout(500)
  q = await gameQuery(pageR)
  const stickers = await pageR.locator('#fx .groom-sticker').count()
  log(
    'Reduced motion: salute does not block play (no lingering particles)',
    q.roundOpen === true &&
      q.groomSaluteActive === false &&
      stickers === 0 &&
      Number(q.groomSaluteFires || 0) >= firesBefore + 1,
    `active=${q.groomSaluteActive} stickers=${stickers} fires=${q.groomSaluteFires}`,
  )
  // Score path must work immediately under reduced motion.
  const canBanditR =
    (await pageR.locator('#banditBox.show').count()) > 0 &&
    !(await pageR.locator('#banditBtn').evaluate((el) => el.hidden).catch(() => true))
  if (canBanditR) {
    await pageR.click('#banditBtn')
    await pageR.waitForFunction(() => window.Malchishnik.query().scoreActionsVisible === true, null, {
      timeout: 8000,
    })
  }
  log(
    'Reduced motion: done/fail reachable with Round open',
    (await gameQuery(pageR)).scoreActionsVisible === true &&
      (await pageR.locator('#doneBtn').isVisible()),
    `scoreActionsVisible=${(await gameQuery(pageR)).scoreActionsVisible}`,
  )
  await pageR.click('#doneBtn')
  await pageR.waitForFunction(() => window.Malchishnik.query().roundOpen === false, null, {
    timeout: 10000,
  })
  log(
    'Reduced motion: scoring closes Round without being blocked',
    (await gameQuery(pageR)).roundOpen === false,
    `roundOpen=${(await gameQuery(pageR)).roundOpen}`,
  )
  await reduced.close()
  await browser.close()

  fs.writeFileSync(path.join(OUT, 'report.txt'), report.join('\n') + '\n')
  const failed = report.filter((l) => l.startsWith('FAIL')).length
  console.log('\n=== SUMMARY ===')
  console.log(`failures: ${failed} usedBandit=${usedBandit}`)
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
