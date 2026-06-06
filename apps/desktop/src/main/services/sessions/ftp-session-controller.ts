import { randomUUID } from 'node:crypto'
import { readFile, stat, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Client as BasicFtpClient } from 'basic-ftp'
import type { FtpProfile, FtpSessionController, PermissionChangeOptions, RemoteFileItem, TransferProgress } from '@termdock/core'
import { BaseFileSessionController } from './base-file-session-controller.js'
import { parentRemotePath, toFtpRemoteFileItem } from './session-file-utils.js'
import { decodeBuffer, encodeText } from '../text-encoding.js'

export class LiveFtpSessionController extends BaseFileSessionController implements FtpSessionController {
  readonly type = 'ftp'

  private readonly ftp = new BasicFtpClient(20000)
  private currentRemotePath: string
  private operationQueue: Promise<unknown> = Promise.resolve()

  constructor(id: string, profile: FtpProfile) {
    super(id, 'ftp', profile)
    this.currentRemotePath = profile.remotePath || '/'
  }

  override async connect(): Promise<void> {
    await this.runSerialized(async () => {
      if (this.connected) {
        return
      }

      await this.connectInternal()
    })
  }

  override async disconnect(): Promise<void> {
    await this.runSerialized(async () => {
      this.disconnectInternal()
    })
  }

  override getRemotePath(): string {
    return this.currentRemotePath
  }

  async abortTransfer(): Promise<void> {
    await this.runSerialized(async () => {
      this.disconnectInternal()
    })
  }

  async listRemoteFiles(): Promise<RemoteFileItem[]> {
    return this.runWithConnectedClient(() => this.readRemoteDirectory(this.currentRemotePath))
  }

  async openRemotePath(nextPath: string): Promise<RemoteFileItem[]> {
    return this.runWithConnectedClient(async () => {
      await this.ftp.cd(nextPath)
      this.currentRemotePath = await this.ftp.pwd()
      return this.readRemoteDirectory(this.currentRemotePath)
    })
  }

  async readRemoteFile(targetPath: string, encoding = 'utf-8'): Promise<string> {
    return this.runWithConnectedClient(async () => {
      const localPath = this.tempFilePath(targetPath)
      try {
        await this.ftp.downloadTo(localPath, targetPath)
        return decodeBuffer(await readFile(localPath), encoding)
      } finally {
        void unlink(localPath).catch(() => undefined)
      }
    })
  }

  async writeRemoteFile(targetPath: string, content: string, encoding = 'utf-8'): Promise<void> {
    await this.runWithConnectedClient(async () => {
      const localPath = this.tempFilePath(targetPath)
      try {
        await writeFile(localPath, encodeText(content, encoding))
        await this.ensureRemoteDirectoryInternal(path.posix.dirname(targetPath))
        await this.ftp.uploadFrom(localPath, targetPath)
      } finally {
        void unlink(localPath).catch(() => undefined)
      }
    })
  }

  async copyRemotePath(_targetPath: string, _destinationPath: string, _targetType: RemoteFileItem['type']): Promise<void> {
    throw new Error('FTP 暂不支持服务器内复制，请改用下载后上传')
  }

  async moveRemotePath(targetPath: string, destinationPath: string): Promise<void> {
    await this.renameRemotePath(targetPath, destinationPath)
  }

  async renameRemotePath(targetPath: string, nextPath: string): Promise<void> {
    await this.runWithConnectedClient(async () => {
      await this.ftp.rename(targetPath, nextPath)
    })
  }

  async deleteRemotePath(targetPath: string, targetType: RemoteFileItem['type']): Promise<void> {
    await this.runWithConnectedClient(async () => {
      if (targetType === 'folder') {
        await this.ftp.removeDir(targetPath)
        return
      }
      await this.ftp.remove(targetPath)
    })
  }

  async changeRemotePermissions(targetPath: string, options: PermissionChangeOptions): Promise<void> {
    validateMode(options.mode)
    await this.runWithConnectedClient(async () => {
      if (options.recursive) {
        throw new Error('FTP 暂不支持递归修改权限')
      }
      await this.ftp.send(`SITE CHMOD ${options.mode.trim()} ${targetPath}`)
    })
  }

  async ensureRemoteDirectory(targetPath: string): Promise<void> {
    await this.runWithConnectedClient(async () => {
      await this.ensureRemoteDirectoryInternal(targetPath)
    })
  }

  async uploadFile(localPath: string, remotePath: string, onProgress: (progress: TransferProgress) => void): Promise<void> {
    const info = await stat(localPath)
    const total = Math.max(info.size, 1)
    await this.runWithConnectedClient(async () => {
      this.ftp.trackProgress((progress) => {
        onProgress({
          percent: Math.min(99, Math.round((progress.bytes / total) * 100)),
          transferredBytes: progress.bytes,
          totalBytes: total
        })
      })
      try {
        await this.ensureRemoteDirectoryInternal(path.posix.dirname(remotePath))
        await this.ftp.uploadFrom(localPath, remotePath)
        onProgress({ percent: 100, transferredBytes: total, totalBytes: total })
      } finally {
        this.ftp.trackProgress()
      }
    })
  }

  async downloadFile(remotePath: string, localPath: string, onProgress: (progress: TransferProgress) => void): Promise<void> {
    await this.runWithConnectedClient(async () => {
      const total = Math.max(await this.ftp.size(remotePath), 1)
      this.ftp.trackProgress((progress) => {
        onProgress({
          percent: Math.min(99, Math.round((progress.bytes / total) * 100)),
          transferredBytes: progress.bytes,
          totalBytes: total
        })
      })
      try {
        await this.ftp.downloadTo(localPath, remotePath)
        onProgress({ percent: 100, transferredBytes: total, totalBytes: total })
      } finally {
        this.ftp.trackProgress()
      }
    })
  }

  private async connectInternal(): Promise<void> {
    const profile = this.profile as FtpProfile
    await this.ftp.access({
      host: profile.host,
      port: profile.port,
      user: profile.username,
      password: profile.password,
      secure: profile.secure
    })
    this.connected = true
    try {
      await this.ftp.cd(this.currentRemotePath)
      this.currentRemotePath = await this.ftp.pwd()
    } catch {
      this.currentRemotePath = profile.remotePath || '/'
    }
  }

  private disconnectInternal() {
    this.ftp.close()
    this.connected = false
  }

  private async readRemoteDirectory(targetPath: string): Promise<RemoteFileItem[]> {
    const entries = await this.ftp.list(targetPath)
    const rows = entries
      .filter((entry) => entry.name !== '.' && entry.name !== '..')
      .map((entry) => toFtpRemoteFileItem(targetPath, entry))
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'folder' ? -1 : 1
        }
        return left.name.localeCompare(right.name)
      })

    if (targetPath !== '/') {
      rows.unshift({
        path: parentRemotePath(targetPath),
        name: '..',
        type: 'folder',
        modified: '',
        size: '-',
        permission: '',
        ownerGroup: ''
      })
    }

    return rows
  }

  private tempFilePath(remotePath: string) {
    return path.join(os.tmpdir(), `termdock-${randomUUID()}-${path.posix.basename(remotePath) || 'remote-file'}`)
  }

  private async ensureConnected() {
    if (!this.connected) {
      await this.connectInternal()
    }
  }

  private async ensureRemoteDirectoryInternal(targetPath: string) {
    if (!targetPath || targetPath === '.') {
      return
    }

    const previousPath = await this.ftp.pwd()
    try {
      await this.ftp.ensureDir(targetPath)
    } finally {
      await this.ftp.cd(previousPath)
    }
  }

  private async runWithConnectedClient<T>(operation: () => Promise<T>): Promise<T> {
    return this.runSerialized(async () => {
      await this.ensureConnected()
      return operation()
    })
  }

  private async runSerialized<T>(operation: () => Promise<T>): Promise<T> {
    const nextOperation = this.operationQueue.catch(() => undefined).then(operation)
    this.operationQueue = nextOperation.then(() => undefined, () => undefined)
    return nextOperation
  }
}

function validateMode(mode: string) {
  if (!/^[0-7]{3,4}$/.test(mode.trim())) {
    throw new Error('权限值必须是 3 到 4 位八进制数字，例如 755')
  }
}
