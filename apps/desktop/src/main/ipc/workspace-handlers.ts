import { BrowserWindow, ipcMain } from 'electron'
import type { CreateProfileInput } from '@termdock/core'
import type { IpcServices, IpcWindowOptions } from './types.js'

export function registerWorkspaceHandlers(services: IpcServices, options: IpcWindowOptions) {
  const { workspaceService, broadcastSnapshot } = services

  ipcMain.handle('workspace:getSnapshot', () => workspaceService.getSnapshot())

  ipcMain.handle('workspace:createProfile', async (_, input: CreateProfileInput) => {
    const snapshot = await workspaceService.createProfile(input)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:updateProfile', async (_, profileId: string, input: CreateProfileInput) => {
    const snapshot = await workspaceService.updateProfile(profileId, input)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:deleteProfile', async (_, profileId: string) => {
    const snapshot = await workspaceService.deleteProfile(profileId)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:createFolder', async (_, name: string, parentId?: string) => {
    const snapshot = await workspaceService.createFolder(name, parentId)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:updateFolder', async (_, folderId: string, updates: any) => {
    const snapshot = await workspaceService.updateFolder(folderId, updates)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:deleteFolder', async (_, folderId: string) => {
    const snapshot = await workspaceService.deleteFolder(folderId)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:updateEntityOrder', async (_, id: string, newParentId: string | undefined, newOrder: number) => {
    const snapshot = await workspaceService.updateEntityOrder(id, newParentId, newOrder)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:openProfile', async (event, profileId: string) => {
    const snapshot = await workspaceService.openProfile(profileId, event.sender)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:openProfileFromManager', async (event, profileId: string) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender)
    const targetSender = senderWindow?.getParentWindow()?.webContents ?? options.getMainWindow()?.webContents ?? event.sender
    const snapshot = await workspaceService.openProfile(profileId, targetSender)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:activateTab', async (_, tabId: string) => {
    const snapshot = await workspaceService.activateTab(tabId)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:reconnectTab', async (_, tabId: string) => {
    const snapshot = await workspaceService.reconnectTab(tabId)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:disconnectTab', async (_, tabId: string) => {
    const snapshot = await workspaceService.disconnectTab(tabId)
    broadcastSnapshot(snapshot)
    return snapshot
  })

  ipcMain.handle('workspace:closeTab', async (_, tabId: string) => {
    const snapshot = await workspaceService.closeTab(tabId)
    broadcastSnapshot(snapshot)
    return snapshot
  })
}
