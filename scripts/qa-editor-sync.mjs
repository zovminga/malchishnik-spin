/**
 * Place/Challenge editor while other phones write: half-typed text, caret and
 * focus survive a remote render, typing lands on the right Place even when a peer
 * adds a Place on top, and colours / strings from the Room cannot inject HTML.
 * Seam: window.Malchishnik.query + editor DOM (data-field / data-add-input / data-id)
 * + Playwright multi-context (+ Firebase room). Isolated ?room= ids only.
 */
import { chromium } from 'playwright'

import { chromePath, ensurePlayers, roomUrl, waitForGame } from './qa-lib.mjs'

const BASE = (process.env.QA_URL || process.env.BASE || 'http://127.0.0.1:8765/').replace(
  /\/?$/,
  '/',
)
const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const SYNC_MS = 10000
const PAYLOAD = '#f00"/><img src=x onerror="window.__qaXss=(window.__qaXss||0)+1">'

let failures = 0
function log(step, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${step}${detail ? ' — ' + detail : ''}`)
  if (!ok) failures++
}

async function newPhone(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
  })
  const page = await context.newPage()
  page.on('dialog', (d) => d.accept())
  return { context, page }
}

async function openRoom(phone, room) {
  await phone.page.goto(roomUrl(BASE, room), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitForGame(phone.page)
  await phone.page.waitForTimeout(1500)
}

// Peer write that does not touch the editor content.
async function peerAddsPlayer(page, name) {
  await page.fill('#playerInput', name)
  await page.click('#addPlayerBtn')
}

function focusInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement
    const block = el && el.closest && el.closest('.place-block')
    return {
      placeId: block ? block.getAttribute('data-id') : null,
      field: el ? el.getAttribute('data-field') || (el.hasAttribute('data-add-input') ? 'add' : el.id) : null,
      value: el && 'value' in el ? el.value : null,
      caret: el && typeof el.selectionStart === 'number' ? el.selectionStart : null,
    }
  })
}

async function waitPeerPaint(page, name) {
  await page
    .waitForFunction((n) => window.Malchishnik.query().scores.some((p) => p.name === n), name, {
      timeout: SYNC_MS,
    })
    .catch(() => {})
  await page.waitForTimeout(400)
}

async function typingSurvivesPeerWrites(browser) {
  const room = 'qa-editor-sync-' + Date.now()
  const A = await newPhone(browser)
  const B = await newPhone(browser)
  await openRoom(A, room)
  await ensurePlayers(A.page, ['Azat'])
  await openRoom(B, room)
  await A.page.locator('#editorToggle').click({ force: true })
  await B.page.locator('#editorToggle').click({ force: true })

  // Half-typed new Challenge in the second Place block.
  const target = A.page.locator('#editorList .place-block').nth(1)
  const targetId = await target.getAttribute('data-id')
  const add = target.locator('[data-add-input]')
  await add.click()
  await add.type('Половина задан', { delay: 15 })
  await peerAddsPlayer(B.page, 'Ivan')
  await waitPeerPaint(A.page, 'Ivan')
  let f = await focusInfo(A.page)
  log(
    '[add] half-typed Challenge, focus and caret survive a peer write',
    f.placeId === targetId && f.field === 'add' && f.value === 'Половина задан' && f.caret === 14,
    JSON.stringify(f),
  )

  // Peer adds a Place on top: indexes shift, typing must stay on the same Place.
  await B.page.locator('#addPlaceBtn').click({ force: true })
  await A.page
    .waitForFunction(
      (n) => document.querySelectorAll('#editorList .place-block').length === n,
      (await A.page.locator('#editorList .place-block').count()) + 1,
      { timeout: SYNC_MS },
    )
    .catch(() => {})
  await A.page.waitForTimeout(400)
  f = await focusInfo(A.page)
  log(
    '[add] typing stays on the same Place after a peer adds a Place on top',
    f.placeId === targetId && f.field === 'add' && f.value === 'Половина задан',
    JSON.stringify(f),
  )
  await A.page.keyboard.type('ия')
  await A.page.locator(`#editorList .place-block[data-id="${targetId}"] [data-add-chal]`).click()
  const landed = await B.page
    .waitForFunction(
      (id) => {
        const block = document.querySelector(`#editorList .place-block[data-id="${id}"]`)
        return !!block && /Половина задания/.test(block.textContent || '')
      },
      targetId,
      { timeout: SYNC_MS },
    )
    .then(() => true)
    .catch(() => false)
  log('[add] the Challenge lands on the Place it was typed for, on the peer too', landed)

  // Half-typed Place label (committed only on blur).
  const label = A.page.locator(`#editorList .place-block[data-id="${targetId}"] [data-field="label"]`)
  await label.click()
  await label.fill('НОВОЕ ИМЯ')
  await peerAddsPlayer(B.page, 'Petr')
  await waitPeerPaint(A.page, 'Petr')
  f = await focusInfo(A.page)
  log(
    '[label] half-typed Place label and focus survive a peer write',
    f.placeId === targetId && f.field === 'label' && f.value === 'НОВОЕ ИМЯ',
    JSON.stringify(f),
  )
  await A.page.keyboard.press('Tab')
  const renamed = await B.page
    .waitForFunction(
      (id) => {
        const input = document.querySelector(`#editorList .place-block[data-id="${id}"] [data-field="label"]`)
        return !!input && input.value === 'НОВОЕ ИМЯ'
      },
      targetId,
      { timeout: SYNC_MS },
    )
    .then(() => true)
    .catch(() => false)
  log('[label] label commits on blur and reaches the peer', renamed)
  await A.context.close()
  await B.context.close()
}

async function putState(url, obj) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
  if (!res.ok) throw new Error('PUT failed ' + res.status)
}

async function patchState(url, obj) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj),
  })
  if (!res.ok) throw new Error('PATCH failed ' + res.status)
}

async function xssCount(page) {
  return page.evaluate(() => ({
    ran: window.__qaXss || 0,
    injected: document.querySelectorAll('img[src="x"]').length,
    wheelSlices: document.querySelectorAll('#wheel svg path').length,
  }))
}

// Anyone with the public web config can write any Room field.
async function hostileColours(browser) {
  const room = 'qa-editor-xss-' + Date.now()
  const stateUrl = `${DB}/rooms/${room}/state.json`
  await putState(stateUrl, {
    destinations: [
      { id: 'bar', label: 'БАР', tagline: 'x', color: PAYLOAD, text: PAYLOAD },
      { id: 'casino', label: 'КАЗИНО', tagline: 'y', color: '#ff003c', text: '#fff' },
    ],
    challenges: { bar: ['Пить'], casino: [] },
    players: [{ id: 'p1', name: 'Azat', score: 1 }],
    activePlayer: 0,
    round: {
      owner: 0,
      placeId: 'bar',
      placeLabel: 'БАР',
      placeColor: PAYLOAD,
      settled: true,
      scored: false,
      token: 'xss-round',
    },
    history: [{ who: 'Azat', place: 'БАР', note: 'был там (+1)', color: PAYLOAD }],
    updatedAt: Date.now(),
    updatedBy: 'seed',
  })
  const A = await newPhone(browser)
  await openRoom(A, room)
  await A.page.locator('#editorToggle').click({ force: true })
  await A.page.waitForTimeout(800)
  let x = await xssCount(A.page)
  log('[xss] fresh joiner: hostile colours do not inject HTML', x.ran === 0 && x.injected === 0, JSON.stringify(x))
  log('[xss] wheel still renders every Place', x.wheelSlices === 2, JSON.stringify(x))

  // Live phone receives a hostile colour on the next Room write.
  await patchState(stateUrl, {
    'destinations/1/color': PAYLOAD,
    updatedAt: Date.now() + 1000,
    updatedBy: 'hostile',
  })
  await A.page.waitForTimeout(2500)
  x = await xssCount(A.page)
  log('[xss] live phone: hostile colour from a Room write does not inject HTML', x.ran === 0 && x.injected === 0, JSON.stringify(x))
  await A.context.close()
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath() })
  try {
    await typingSurvivesPeerWrites(browser)
    await hostileColours(browser)
  } finally {
    await browser.close()
  }
  console.log(failures ? `FAILED ${failures}` : 'ALL GREEN')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
