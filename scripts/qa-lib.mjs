/**
 * Shared Playwright helpers over window.Malchishnik (Game.query seam).
 */
export async function waitForGame(page, timeout = 20000) {
  await page.waitForFunction(
    () =>
      window.Malchishnik &&
      typeof window.Malchishnik.query === 'function' &&
      typeof window.Malchishnik.richness === 'function',
    null,
    { timeout },
  )
}

export async function gameQuery(page) {
  await waitForGame(page)
  return page.evaluate(() => window.Malchishnik.query())
}

export async function waitSpinSettled(page, timeout = 20000) {
  await waitForGame(page)
  // Avoid racing the click: wait until spin starts (or round already open), then idle.
  await page
    .waitForFunction(
      () => {
        const q = window.Malchishnik.query()
        const btn = document.getElementById('spinBtn')
        const t = (btn && btn.textContent) || ''
        return q.spinning || /КРУТИТСЯ/i.test(t) || (q.roundOpen && !!document.querySelector('.result-label'))
      },
      null,
      { timeout: Math.min(8000, timeout) },
    )
    .catch(() => {})
  await page.waitForFunction(
    () => {
      const q = window.Malchishnik.query()
      const btn = document.getElementById('spinBtn')
      const t = (btn && btn.textContent) || ''
      return !q.spinning && !q.banditSpinning && !/КРУТИТСЯ/i.test(t) && window.Malchishnik.isSpinSettled()
    },
    null,
    { timeout },
  )
}

/** Run RoomState.richness inside the page (single source of truth). */
export async function pageRichness(page, state) {
  await waitForGame(page)
  return page.evaluate((s) => window.Malchishnik.richness(s), state)
}

export function chromePath() {
  return process.env.CHROME || '/usr/bin/google-chrome-stable'
}

/** Isolate from the default shared room. */
export function roomUrl(base, room) {
  const root = String(base || '').replace(/\/?$/, '/')
  const id = (room || 'qa-' + Date.now()).replace(/[^\w\-]/g, '').slice(0, 40)
  return `${root}index.html?room=${id}&t=${Date.now()}`
}

export async function ensurePlayers(page, names = ['Azat', 'Alexander']) {
  let q = await gameQuery(page)
  const have = new Set((q.scores || []).map((p) => String(p.name || '').toLowerCase()))
  for (const name of names) {
    if (have.has(String(name).toLowerCase())) continue
    await page.fill('#playerInput', name)
    await page.click('#addPlayerBtn')
    await page.waitForTimeout(250)
    have.add(String(name).toLowerCase())
  }
  return gameQuery(page)
}

/** Score Clear via stable control id (ADR-0005). Legacy #resetGameBtn kept as fallback. */
export async function resetGame(page) {
  const btn = page.locator('#scoreClearBtn, #resetGameBtn').first()
  await btn.click()
  await page.waitForTimeout(600)
}
