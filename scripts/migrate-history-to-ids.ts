import { migrateHistoryFilesToIds } from '../server/utils/history-migration'

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')

const result = migrateHistoryFilesToIds({ dryRun })

console.log(`${dryRun ? '[dry-run] ' : ''}Migrated ${result.migrated} history file(s). Skipped ${result.skipped}.`)
if (result.details.length > 0) {
  for (const item of result.details) {
    if (item.status === 'migrated') {
      console.log(`- migrated: ${item.file} -> ${item.id ?? ''}`.trim())
    } else {
      console.log(`- skipped: ${item.file} (${item.reason ?? 'unknown'})${item.id ? ` -> ${item.id}` : ''}`)
    }
  }
}
