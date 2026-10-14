/**
 * Shared Playwright helpers over window.Malchishnik (Game.query seam).
 */
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

// Default target is the working copy on the local server (npm start), not live Pages.
export const LOCAL_BASE = 'http://127.0.0.1:8765/'
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
]
// Room ids QA may write to; the party Room (no ?room=) is never a fixture.
const TEST_ROOM_PREFIXES = ['qa-', 'review-']

/** Page base URL: QA_URL / BASE env, else the local server. */
export function qaBase() {
  return String(process.env.QA_URL || process.env.BASE || LOCAL_BASE).replace(/\/?$/, '/')
}

/** Folder for screenshots / reports: QA_OUT, else qa-artifacts/<name> in the repo, else tmp. */
export function artifactDir(name) {
  const dirs = [process.env.QA_OUT, path.join(REPO_ROOT, 'qa-artifacts', name), path.join(os.tmpdir(), 'malchishnik-qa', name)]
  for (const dir of dirs) {
    if (!dir) continue
    try {
      fs.mkdirSync(dir, { recursive: true })
      return dir
    } catch (e) {
      if (e.code !== 'EACCES' && e.code !== 'EROFS' && e.code !== 'ENOENT') throw e
    }
  }
  throw new Error('no writable artifact folder for ' + name)
}
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

/** CHROME env, else an installed Chrome, else undefined (Playwright's bundled Chromium). */
export function chromePath() {
  if (process.env.CHROME) return process.env.CHROME
  return CHROME_CANDIDATES.find((p) => fs.existsSync(p))
}

// Firebase rules do not allow listing Rooms, so QA keeps its own list for scripts/qa-rooms.mjs.
export const TEST_ROOMS_FILE = path.join(REPO_ROOT, 'qa-artifacts', 'rooms.txt')

/** Throw unless the Room id is an isolated test Room; record it for later clean-up. */
export function assertTestRoom(room) {
  if (!TEST_ROOM_PREFIXES.some((prefix) => String(room).startsWith(prefix))) {
    throw new Error(`refusing to use Room "${room}": QA Rooms must start with ${TEST_ROOM_PREFIXES.join(' / ')}`)
  }
  try {
    fs.mkdirSync(path.dirname(TEST_ROOMS_FILE), { recursive: true })
    fs.appendFileSync(TEST_ROOMS_FILE, room + '\n')
  } catch (e) {
    if (e.code !== 'EACCES' && e.code !== 'EROFS') throw e
  }
  return room
}

/** Isolate from the default shared room. */
export function roomUrl(base, room) {
  const root = String(base || '').replace(/\/?$/, '/')
  const id = assertTestRoom((room || 'qa-' + Date.now()).replace(/[^\w\-]/g, '').slice(0, 40))
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

/** Click a bottom reset control; scroll + force avoids tall scoreboard hit-test flakes. */
async function clickResetControl(page, selector) {
  const btn = page.locator(selector).first()
  await btn.scrollIntoViewIfNeeded()
  await btn.click({ force: true })
  await page.waitForTimeout(600)
}

/** Score Clear via stable control id (ADR-0005). Legacy #resetGameBtn kept as fallback. */
export async function resetGame(page) {
  await clickResetControl(page, '#scoreClearBtn, #resetGameBtn')
}

/** Game Restart via stable control id (ADR-0005). */
export async function gameRestart(page) {
  await clickResetControl(page, '#gameRestartBtn')
}
