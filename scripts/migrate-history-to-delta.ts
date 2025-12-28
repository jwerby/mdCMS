#!/usr/bin/env npx tsx
/**
 * Migration script: Convert legacy full-content history to delta format
 *
 * Usage: npx tsx scripts/migrate-history-to-delta.ts [--dry-run]
 *
 * Options:
 *   --dry-run   Show what would be migrated without making changes
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  convertToDeltaFormat,
  calculateCompressionRatio,
  DeltaVersionEntry
} from '../lib/history/delta-storage'

const HISTORY_DIR = path.join(process.cwd(), 'content/.history')
const DRY_RUN = process.argv.includes('--dry-run')

interface LegacyVersion {
  id: string
  timestamp: number
  content: string
  type: 'post' | 'page'
  slug: string
  summary?: string
}

interface HistoryFile {
  version: 2
  useDelta: true
  entries: DeltaVersionEntry[]
}

function isLegacyFormat(data: unknown): data is LegacyVersion[] {
  return Array.isArray(data) && (data.length === 0 || !('version' in data))
}

async function migrateHistoryFiles() {
  console.log('🔄 History Migration: Legacy → Delta Format')
  console.log('='.repeat(50))

  if (DRY_RUN) {
    console.log('📋 DRY RUN MODE - No changes will be made\n')
  }

  // Check if history directory exists
  if (!fs.existsSync(HISTORY_DIR)) {
    console.log('ℹ️  No history directory found. Nothing to migrate.')
    return
  }

  const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'))

  if (files.length === 0) {
    console.log('ℹ️  No history files found. Nothing to migrate.')
    return
  }

  console.log(`📁 Found ${files.length} history file(s)\n`)

  let migratedCount = 0
  let skippedCount = 0
  let errorCount = 0
  let totalSavings = { before: 0, after: 0 }

  for (const file of files) {
    const filePath = path.join(HISTORY_DIR, file)

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const data = JSON.parse(content)

      if (!isLegacyFormat(data)) {
        console.log(`⏭️  ${file} - Already in delta format, skipping`)
        skippedCount++
        continue
      }

      if (data.length === 0) {
        console.log(`⏭️  ${file} - Empty history, skipping`)
        skippedCount++
        continue
      }

      // Convert to delta format
      const deltaEntries = convertToDeltaFormat(data)

      // Calculate compression
      const compression = calculateCompressionRatio(data, deltaEntries)
      totalSavings.before += compression.fullSize
      totalSavings.after += compression.deltaSize

      console.log(`📄 ${file}:`)
      console.log(`   Versions: ${data.length}`)
      console.log(`   Size: ${formatBytes(compression.fullSize)} → ${formatBytes(compression.deltaSize)}`)
      console.log(`   Savings: ${compression.savings}`)

      if (!DRY_RUN) {
        // Create new format
        const newHistoryFile: HistoryFile = {
          version: 2,
          useDelta: true,
          entries: deltaEntries
        }

        // Backup original
        const backupPath = filePath + '.backup'
        fs.copyFileSync(filePath, backupPath)

        // Write new format
        fs.writeFileSync(filePath, JSON.stringify(newHistoryFile, null, 2))
        console.log(`   ✅ Migrated (backup: ${file}.backup)`)
      } else {
        console.log(`   📋 Would migrate`)
      }

      migratedCount++
      console.log()
    } catch (error) {
      console.log(`❌ ${file} - Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      errorCount++
    }
  }

  // Summary
  console.log('='.repeat(50))
  console.log('📊 Migration Summary:')
  console.log(`   Migrated: ${migratedCount}`)
  console.log(`   Skipped:  ${skippedCount}`)
  console.log(`   Errors:   ${errorCount}`)

  if (totalSavings.before > 0) {
    const overallSavings = ((1 - totalSavings.after / totalSavings.before) * 100).toFixed(1)
    console.log(`\n💾 Total Storage:`)
    console.log(`   Before: ${formatBytes(totalSavings.before)}`)
    console.log(`   After:  ${formatBytes(totalSavings.after)}`)
    console.log(`   Saved:  ${overallSavings}%`)
  }

  if (DRY_RUN && migratedCount > 0) {
    console.log('\n💡 Run without --dry-run to apply changes')
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Run migration
migrateHistoryFiles().catch(console.error)
