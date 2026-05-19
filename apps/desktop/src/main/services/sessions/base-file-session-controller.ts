import type { ConnectionProfile, FileSessionController, PermissionChangeOptions, RemoteFileItem, TransferProgress } from '@termdock/core'

export abstract class BaseFileSessionController implements FileSessionController {
  readonly id: string
  readonly type: 'ssh' | 'ftp'

  protected connected = false

  constructor(
    id: string,
    type: 'ssh' | 'ftp',
    protected readonly profile: ConnectionProfile
  ) {
    this.id = id
    this.type = type
  }

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  getSummary(): string {
    return this.connected
      ? `Connected to ${this.profile.host}:${this.profile.port}`
      : `Ready to connect ${this.profile.host}:${this.profile.port}`
  }

  getRemotePath(): string {
    return this.profile.remotePath
  }

  abstract listRemoteFiles(): Promise<RemoteFileItem[]>
  abstract openRemotePath(path: string): Promise<RemoteFileItem[]>
  abstract readRemoteFile(path: string, encoding?: string): Promise<string>
  abstract writeRemoteFile(path: string, content: string, encoding?: string): Promise<void>
  abstract renameRemotePath(path: string, nextPath: string): Promise<void>
  abstract deleteRemotePath(path: string, targetType: RemoteFileItem['type']): Promise<void>
  abstract changeRemotePermissions(path: string, options: PermissionChangeOptions): Promise<void>
  abstract ensureRemoteDirectory(path: string): Promise<void>
  abstract abortTransfer(): Promise<void>
  abstract uploadFile(localPath: string, remotePath: string, onProgress: (progress: TransferProgress) => void): Promise<void>
  abstract downloadFile(remotePath: string, localPath: string, onProgress: (progress: TransferProgress) => void): Promise<void>
}
