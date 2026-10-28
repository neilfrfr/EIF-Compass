#!/usr/bin/env node
// Validates backend/supabase/migrations and, optionally, compares it with the
// hosted migration ledger.
//
//   node scripts/check-migrations.mjs
//   node scripts/check-migrations.mjs --ledger ledger.txt
//
// ledger.txt is the output of backend/supabase/operations/ledger-query.sql
// (one row per line, version first). Exit code 1 means a problem was found.
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dir = join(root, 'backend', 'supabase', 'migrations')
const args = process.argv.slice(2)
const ledgerFlag = args.indexOf('--ledger')
const ledgerPath = ledgerFlag >= 0 ? args[ledgerFlag + 1] : null

const problems = []
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const pattern = /^(\d{14})_([a-z0-9_]+)\.sql$/
const versions = []

for (const file of files) {
  const match = pattern.exec(file)
  if (!match) {
    problems.push(`Bad filename (expected YYYYMMDDHHMMSS_name.sql): ${file}`)
    continue
  }
  versions.push(match[1])
}

versions.forEach((version, i) => {
  if (i > 0 && version === versions[i - 1]) problems.push(`Duplicate version: ${version}`)
})

console.log(`Local migrations: ${versions.length}`)
for (const file of files) console.log(`  ${file}`)

if (ledgerPath) {
  const hosted = new Set(
    readFileSync(ledgerPath, 'utf8')
      .split('\n')
      .map((line) => /\b(\d{14})\b/.exec(line)?.[1])
      .filter(Boolean),
  )
  const local = new Set(versions)
  const missingRemote = versions.filter((v) => !hosted.has(v))
  const missingLocal = [...hosted].filter((v) => !local.has(v)).sort()
  console.log(`\nHosted ledger entries: ${hosted.size}`)
  if (missingRemote.length) {
    console.log('\nIn the repo but NOT in the hosted ledger (apply, or confirm already applied and repair the ledger):')
    missingRemote.forEach((v) => console.log(`  ${files.find((f) => f.startsWith(v))}`))
    problems.push(`${missingRemote.length} local migration(s) missing from the hosted ledger`)
  }
  if (missingLocal.length) {
    console.log('\nIn the hosted ledger but with NO local file (add the file, do not rerun):')
    missingLocal.forEach((v) => console.log(`  ${v}`))
    problems.push(`${missingLocal.length} hosted migration(s) without a local file`)
  }
  if (!missingRemote.length && !missingLocal.length) console.log('Ledger and folder match.')
} else {
  console.log('\nNo --ledger given: only the local folder was checked.')
}

if (problems.length) {
  console.error('\nProblems:')
  problems.forEach((p) => console.error(`  - ${p}`))
  process.exit(1)
}
console.log('\nOK')
