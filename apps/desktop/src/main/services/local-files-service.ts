import { readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { LocalFileItem } from '@termdock/core'

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = -1
  do {
    value /= 1024
    unit += 1
  } while (value >= 1024 && unit < units.length - 1)
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`
}

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${year}/${month}/${day} ${hours}:${minutes}`
}

export class LocalFilesService {
  readonly initialPath = os.homedir()

  async listDirectory(dirPath = this.initialPath): Promise<{ path: string, items: LocalFileItem[] }> {
    const entries = await readdir(dirPath, { withFileTypes: true })
    const rows = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dirPath, entry.name)
      const info = await stat(fullPath)
      return {
        path: fullPath,
        name: entry.name,
        type: entry.isDirectory() ? 'folder' : 'file',
        modified: formatDate(info.mtime),
        size: entry.isDirectory() ? '-' : formatSize(info.size)
      } satisfies LocalFileItem
    }))

    rows.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    })

    return {
      path: dirPath,
      items: rows
    }
  }
}
