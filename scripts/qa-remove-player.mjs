/**
 * Roster remove: × on Player chip drops them from scores; history stays;
 * Round Owner cannot be removed while Round is open; Turn Player advances.
 * Seam: window.Malchishnik.query + .player-remove clicks.
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
const OUT = process.env.QA_OUT || '/opt/cursor/artifacts/qa-remove-player'
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

async function removeBtn(page, name) {
  return page.getByRole('button', { name: new RegExp(`^Удалить\\s+${name}$`, 'i') }).first()
}

async function scoreOpenRound(page) {
  const banditBtn = page.locator('#banditBtn')
  if (await banditBtn.count()) {
    const hidden = await banditBtn.evaluate((el) => el.hidden)
    if (!hidden && !(await banditBtn.isDisabled())) {
      await banditBtn.click()
      await page.waitForTimeout(3200)
      await page
        .waitForFunction(() => {
          const actions = document.getElementById('scoreActions')
          return actions && !actions.hidden
        }, null, { timeout: 8000 })
        .catch(() => {})
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

  await page.goto(roomUrl(BASE, 'qa-remove-player-' + Date.now()), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await waitForGame(page)
  await resetGame(page)
  await ensurePlayers(page, ['Azat', 'Alexander'])

  let q = await gameQuery(page)
  const removeCount = await page.locator('.player-remove').count()
  log(
    'Remove controls visible on Player chips',
    removeCount >= 2,
    `removeButtons=${removeCount} scores=${q.scores.map((p) => p.name).join(',')}`,
  )
  await shot(page, '01-roster-with-remove.png')

  // Remove non-turn Player (Alexander); Azat stays Turn Player.
  await page.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await page.waitForTimeout(200)
  await (await removeBtn(page, 'Alexander')).click()
  await page.waitForTimeout(400)
  q = await gameQuery(page)
  const names = q.scores.map((p) => p.name)
  log(
    'Removed Player leaves roster and scoreboard',
    names.length === 1 && /Azat/i.test(names[0] || '') && !names.some((n) => /Alexander/i.test(n)),
    names.join(','),
  )
  log('Turn Player unchanged when other removed', /Azat/i.test(q.turnOwnerName || ''), q.turnOwnerName)

  // Re-add Alexander, score a Round as Azat, remove Azat — history keeps the name.
  await page.fill('#playerInput', 'Alexander')
  await page.click('#addPlayerBtn')
  await page.waitForTimeout(300)
  await page.locator('.player-chip', { hasText: /Azat/i }).first().click()
  await page.waitForTimeout(200)
  await page.click('#spinBtn')
  await waitSpinSettled(page)
  await page.waitForTimeout(400)
  await scoreOpenRound(page)
  q = await gameQuery(page)
  const histBefore = (q.history || []).map((h) => h.who || h.note || JSON.stringify(h)).join('|')
  const azatInHistory = (q.history || []).some((h) => /Azat/i.test(String(h.who || '')))
  log('History has Azat after score', azatInHistory, histBefore)

  await (await removeBtn(page, 'Azat')).click()
  await page.waitForTimeout(400)
  q = await gameQuery(page)
  const azatGone = !(q.scores || []).some((p) => /Azat/i.test(p.name))
  const histStill = (q.history || []).some((h) => /Azat/i.test(String(h.who || '')))
  log('History kept after Player removed', azatGone && histStill, `scores=${q.scores.map((p) => p.name).join(',')} histWho=${(q.history || []).map((h) => h.who).join(',')}`)

  // Turn advanced to Alexander (was next after Azat).
  log(
    'Removing Turn Player advances turn',
    /Alexander/i.test(q.turnOwnerName || ''),
    q.turnOwnerName,
  )
  await shot(page, '02-after-remove-scored.png')

  // Open Round: cannot remove Round Owner; can remove other Player.
  await resetGame(page)
  await ensurePlayers(page, ['Azat', 'Alexander', 'Ivan'])
  await page.locator('.player-chip', { hasText: /Alexander/i }).first().click()
  await page.waitForTimeout(200)
  await page.click('#spinBtn')
  await waitSpinSettled(page)
  await page.waitForTimeout(400)
  q = await gameQuery(page)
  log('Round open for Alexander', q.roundOpen === true && /Alexander/i.test(q.turnOwnerName || ''), q.turnOwnerName)

  const ownerRemove = await removeBtn(page, 'Alexander')
  const ownerDisabled = await ownerRemove.isDisabled()
  await ownerRemove.click({ force: true }).catch(() => {})
  await page.waitForTimeout(300)
  q = await gameQuery(page)
  const ownerStill = (q.scores || []).some((p) => /Alexander/i.test(p.name))
  log(
    'Cannot remove Round Owner while Round open',
    ownerStill && q.roundOpen === true,
    `disabled=${ownerDisabled} scores=${q.scores.map((p) => p.name).join(',')} roundOpen=${q.roundOpen}`,
  )

  await (await removeBtn(page, 'Azat')).click()
  await page.waitForTimeout(400)
  q = await gameQuery(page)
  const azatOut = !(q.scores || []).some((p) => /Azat/i.test(p.name))
  const ownerSame = /Alexander/i.test(q.turnOwnerName || '')
  log(
    'Can remove other Player during open Round; Round Owner preserved',
    azatOut && ownerSame && q.roundOpen === true,
    `scores=${q.scores.map((p) => p.name).join(',')} owner=${q.turnOwnerName}`,
  )
  await shot(page, '03-open-round-remove-other.png')

  // Finish round, then empty the roster.
  await scoreOpenRound(page)
  q = await gameQuery(page)
  while ((q.scores || []).length) {
    const name = q.scores[0].name
    await (await removeBtn(page, name)).click()
    await page.waitForTimeout(300)
    q = await gameQuery(page)
  }
  log(
    'Can remove last Player; roster empty',
    (q.scores || []).length === 0 && q.roundOpen === false,
    `scores=${(q.scores || []).length} turn=${q.turnOwnerName}`,
  )
  await shot(page, '04-empty-roster.png')

  const failed = report.some((l) => l.startsWith('FAIL'))
  fs.writeFileSync(path.join(OUT, 'report.txt'), report.join('\n') + '\n')
  await browser.close()
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
