/**
 * List (default) or delete the isolated test Rooms recorded by QA runs in
 * qa-artifacts/rooms.txt. Firebase rules do not allow listing all Rooms, so only
 * Rooms created through qa-lib on this machine are known here; only ids starting
 * with qa- / review- are ever deleted, never the party Room.
 *
 * Usage:
 *   node scripts/qa-rooms.mjs            # dry run: how many recorded test Rooms
 *   node scripts/qa-rooms.mjs --delete   # delete them in Firebase (irreversible) and clear the list
 */
import fs from 'fs'

import { TEST_ROOMS_FILE } from './qa-lib.mjs'

const DB = 'https://malchishnikspin-default-rtdb.firebaseio.com'
const PREFIXES = ['qa-', 'review-']

async function main() {
  const lines = fs.existsSync(TEST_ROOMS_FILE) ? fs.readFileSync(TEST_ROOMS_FILE, 'utf8').split('\n') : []
  const rooms = [...new Set(lines.map((l) => l.trim()).filter((id) => PREFIXES.some((p) => id.startsWith(p))))]
  console.log(`recorded test Rooms: ${rooms.length} (${TEST_ROOMS_FILE})`)
  if (!process.argv.includes('--delete')) {
    console.log('dry run — pass --delete to remove them from Firebase')
    return
  }
  for (const id of rooms) {
    const del = await fetch(`${DB}/rooms/${id}.json`, { method: 'DELETE' })
    if (!del.ok) throw new Error(`delete ${id} failed ${del.status}`)
  }
  fs.writeFileSync(TEST_ROOMS_FILE, '')
  console.log(`deleted ${rooms.length} test Rooms`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
