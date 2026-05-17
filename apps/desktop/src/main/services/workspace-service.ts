import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type { WebContents } from 'electron'
import {
  type ConnectionProfile,
  type CreateProfileInput,
  type SessionSnapshot,
  type TransferTask,
  type WorkspaceSnapshot
} from '@termdock/core'
import type { ProfileRepository } from '@termdock/storage'
import { seedProfiles, seedTransfers } from './workspace/seed-data.js'
import { WorkspaceSessionRuntime } from './workspace/workspace-session-runtime.js'
import { WorkspaceTabsState } from './workspace/workspace-tabs.js'
import { WorkspaceTransfersState } from './workspace/workspace-transfers.js'

export class WorkspaceService {
  private readonly profileRepository: ProfileRepository
  private readonly tabs = new WorkspaceTabsState()
  private readonly transfers = new WorkspaceTransfersState(seedTransfers)
  private readonly sessionRuntime = new WorkspaceSessionRuntime({
    getSnapshot: () => this.getSnapshot(),
    updateTabStatus: (tabId, status) => {
      this.tabs.updateStatus(tabId, status)
    },
    getTabStatus: (tabId) => this.tabs.getById(tabId)?.status
  })

  constructor(profileRepository: ProfileRepository) {
    this.profileRepository = profileRepository
  }

  async getSnapshot(): Promise<WorkspaceSnapshot> {
    return {
      profiles: await this.profileRepository.list(),
      folders: await this.profileRepository.listFolders?.() ?? [],
      tabs: this.tabs.list(),
      activeTabId: this.tabs.getActiveTabId(),
      transfers: this.transfers.list(),
      sessions: this.sessionRuntime.list()
    }
  }

  async createProfile(input: CreateProfileInput): Promise<WorkspaceSnapshot> {
    await this.profileRepository.create(input)
    return this.getSnapshot()
  }

  async updateProfile(profileId: string, input: CreateProfileInput): Promise<WorkspaceSnapshot> {
    await this.profileRepository.update(profileId, input)
    return this.getSnapshot()
  }

  async deleteProfile(profileId: string): Promise<WorkspaceSnapshot> {
    await this.profileRepository.delete(profileId)
    return this.getSnapshot()
  }

  async createFolder(name: string, parentId?: string): Promise<WorkspaceSnapshot> {
    await this.profileRepository.createFolder?.(name, parentId)
    return this.getSnapshot()
  }

  async updateFolder(folderId: string, updates: any): Promise<WorkspaceSnapshot> {
    await this.profileRepository.updateFolder?.(folderId, updates)
    return this.getSnapshot()
  }

  async deleteFolder(folderId: string): Promise<WorkspaceSnapshot> {
    await this.profileRepository.deleteFolder?.(folderId)
    return this.getSnapshot()
  }

  async updateEntityOrder(id: string, newParentId: string | undefined, newOrder: number): Promise<WorkspaceSnapshot> {
    await this.profileRepository.updateOrder?.(id, newParentId, newOrder)
    return this.getSnapshot()
  }

  async openProfile(profileId: string, sender: WebContents): Promise<WorkspaceSnapshot> {
    const profile = await this.profileRepository.getById(profileId)
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`)
    }

    const tabId = randomUUID()
    this.tabs.open(tabId, profile)
    this.sessionRuntime.setSender(tabId, sender)
    const controller = this.createController(tabId, profile)

    const snapshot: SessionSnapshot = {
      profileId: profile.id,
      accessHost: profile.host,
      summary: profile.type === 'ssh' ? '连接主机...' : controller.getSummary(),
      terminalTranscript:
        controller.type === 'ssh' ? controller.getTerminalTranscript() : undefined,
      remotePath: controller.getRemotePath(),
      remoteFiles: [],
      connected: false
    }

    this.sessionRuntime.set(tabId, snapshot)
    void this.sessionRuntime.connect(tabId, controller)

    return this.getSnapshot()
  }

  async reconnectTab(tabId: string): Promise<WorkspaceSnapshot> {
    const tab = this.tabs.getById(tabId)
    if (!tab) {
      throw new Error(`Tab not found: ${tabId}`)
    }

    const sender = this.sessionRuntime.getSender(tabId)
    if (!sender || sender.isDestroyed()) {
      throw new Error(`Tab sender unavailable: ${tabId}`)
    }

    await this.sessionRuntime.disconnect(tabId)

    const profile = await this.profileRepository.getById(tab.profileId)
    if (!profile) {
      throw new Error(`Profile not found: ${tab.profileId}`)
    }

    const current = this.sessionRuntime.get(tabId)
    this.sessionRuntime.set(tabId, {
      profileId: profile.id,
      accessHost: profile.host,
      summary: profile.type === 'ssh' ? '连接主机...' : `连接主机 ${profile.host}:${profile.port}...`,
      terminalTranscript:
        profile.type === 'ssh' ? current?.terminalTranscript ?? '' : undefined,
      remotePath: current?.remotePath ?? profile.remotePath,
      remoteFiles: current?.remoteFiles ?? [],
      connected: false,
      systemMetrics: current?.systemMetrics
    })
    this.tabs.updateStatus(tabId, 'connecting')
    this.tabs.activate(tabId)

    const controller = this.createController(tabId, profile)
    void this.sessionRuntime.connect(tabId, controller)
    await this.sessionRuntime.emitSnapshot(sender)
    return this.getSnapshot()
  }

  async activateTab(tabId: string): Promise<WorkspaceSnapshot> {
    this.tabs.activate(tabId)
    return this.getSnapshot()
  }

  async closeTab(tabId: string): Promise<WorkspaceSnapshot> {
    await this.sessionRuntime.teardown(tabId)
    this.tabs.remove(tabId)
    return this.getSnapshot()
  }

  async disconnectTab(tabId: string): Promise<WorkspaceSnapshot> {
    const tab = this.tabs.getById(tabId)
    const current = this.sessionRuntime.get(tabId)
    if (!tab || !current) {
      throw new Error(`Tab not found: ${tabId}`)
    }

    await this.sessionRuntime.disconnect(tabId)
    this.sessionRuntime.set(tabId, {
      ...current,
      summary: current.accessHost ? `Disconnected from ${current.accessHost}` : 'Disconnected',
      connected: false
    })
    this.tabs.updateStatus(tabId, 'closed')
    await this.sessionRuntime.emitSnapshotForTab(tabId)
    return this.getSnapshot()
  }

  async queueUpload(fileNames: string[]): Promise<WorkspaceSnapshot> {
    this.transfers.queueUploads(fileNames)
    return this.getSnapshot()
  }

  async uploadFile(tabId: string, localPath: string, remoteDirectory: string, sender: WebContents): Promise<WorkspaceSnapshot> {
    const controller = this.sessionRuntime.requireController(tabId)
    const remotePath = path.posix.join(remoteDirectory, path.basename(localPath))
    const transferId = this.addTransfer('upload', path.basename(localPath), sender)

    try {
      await controller.uploadFile(localPath, remotePath, (progress) => {
        void this.updateTransfer(transferId, { progress, status: 'running' }, sender)
      })
      await this.updateTransfer(transferId, { progress: 100, status: 'done' }, sender)
      await this.refreshRemoteFiles(tabId)
    } catch (error) {
      await this.updateTransfer(transferId, {
        status: 'failed',
        message: error instanceof Error ? error.message : '上传失败'
      }, sender)
      throw error
    }

    return this.getSnapshot()
  }

  async downloadFile(tabId: string, remotePath: string, localDirectory: string, sender: WebContents): Promise<WorkspaceSnapshot> {
    const controller = this.sessionRuntime.requireController(tabId)
    const localPath = path.join(localDirectory, path.posix.basename(remotePath))
    const transferId = this.addTransfer('download', path.posix.basename(remotePath), sender)

    try {
      await controller.downloadFile(remotePath, localPath, (progress) => {
        void this.updateTransfer(transferId, { progress, status: 'running' }, sender)
      })
      await this.updateTransfer(transferId, { progress: 100, status: 'done' }, sender)
    } catch (error) {
      await this.updateTransfer(transferId, {
        status: 'failed',
        message: error instanceof Error ? error.message : '下载失败'
      }, sender)
      throw error
    }

    return this.getSnapshot()
  }

  async readRemoteFile(tabId: string, targetPath: string): Promise<string> {
    return this.sessionRuntime.requireController(tabId).readRemoteFile(targetPath)
  }

  async writeRemoteFile(tabId: string, targetPath: string, content: string): Promise<WorkspaceSnapshot> {
    const controller = this.sessionRuntime.requireController(tabId)
    await controller.writeRemoteFile(targetPath, content)
    await this.refreshRemoteFiles(tabId)
    return this.getSnapshot()
  }

  async writeToTerminal(tabId: string, data: string): Promise<void> {
    const controller = this.sessionRuntime.requireController(tabId)
    if (!controller || controller.type !== 'ssh') {
      return
    }
    await controller.write(data)
  }

  async resizeTerminal(tabId: string, cols: number, rows: number): Promise<void> {
    const controller = this.sessionRuntime.requireController(tabId)
    if (!controller || controller.type !== 'ssh') {
      return
    }
    await controller.resize(cols, rows)
  }

  async openRemotePath(tabId: string, targetPath: string): Promise<WorkspaceSnapshot> {
    await this.sessionRuntime.openRemotePath(tabId, targetPath)
    return this.getSnapshot()
  }

  private createController(tabId: string, profile: ConnectionProfile) {
    return this.sessionRuntime.createController(tabId, profile)
  }

  private async refreshRemoteFiles(tabId: string) {
    await this.sessionRuntime.refreshRemoteFiles(tabId)
  }

  private addTransfer(direction: 'upload' | 'download', name: string, sender: WebContents) {
    const transferId = this.transfers.add(direction, name)
    void this.sessionRuntime.emitSnapshot(sender)
    return transferId
  }

  private async updateTransfer(
    transferId: string,
    patch: Partial<Pick<TransferTask, 'progress' | 'status' | 'message'>>,
    sender: WebContents
  ) {
    this.transfers.update(transferId, patch)
    await this.sessionRuntime.emitSnapshot(sender)
  }
}

export { seedProfiles }
