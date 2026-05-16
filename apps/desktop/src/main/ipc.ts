import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import type { OpenDialogOptions } from 'electron'
import type { CreateProfileInput } from '@termdock/core'
import { FileProfileRepository } from './services/file-profile-repository.js'
import { LocalFilesService } from './services/local-files-service.js'
import { WorkspaceService, seedProfiles } from './services/workspace-service.js'

export function registerIpcHandlers(userDataPath: string) {
  const workspaceService = new WorkspaceService(
    new FileProfileRepository(userDataPath, seedProfiles)
  )
  const localFilesService = new LocalFilesService()

  ipcMain.handle('workspace:getSnapshot', () => workspaceService.getSnapshot())
  ipcMain.handle('workspace:createProfile', (_, input: CreateProfileInput) =>
    workspaceService.createProfile(input)
  )
  ipcMain.handle('workspace:updateProfile', (_, profileId: string, input: CreateProfileInput) =>
    workspaceService.updateProfile(profileId, input)
  )
  ipcMain.handle('workspace:deleteProfile', (_, profileId: string) =>
    workspaceService.deleteProfile(profileId)
  )
  ipcMain.handle('workspace:openProfile', (event, profileId: string) =>
    workspaceService.openProfile(profileId, event.sender)
  )
  ipcMain.handle('workspace:activateTab', (_, tabId: string) =>
    workspaceService.activateTab(tabId)
  )
  ipcMain.handle('workspace:closeTab', (_, tabId: string) =>
    workspaceService.closeTab(tabId)
  )
  ipcMain.handle('localFiles:listDirectory', (_, dirPath?: string) =>
    localFilesService.listDirectory(dirPath)
  )
  ipcMain.handle('localFiles:readFile', (_, filePath: string) =>
    localFilesService.readFile(filePath)
  )
  ipcMain.handle('localFiles:writeFile', (_, filePath: string, content: string) =>
    localFilesService.writeFile(filePath, content)
  )
  ipcMain.handle('localFiles:selectFiles', async (event, defaultPath?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options: OpenDialogOptions = {
      defaultPath,
      properties: ['openFile', 'multiSelections']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  })
  ipcMain.handle('localFiles:selectDirectory', async (event, defaultPath?: string) => {
    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined
    const options: OpenDialogOptions = {
      defaultPath: defaultPath || app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)
    return result.canceled ? null : result.filePaths[0] ?? null
  })
  ipcMain.handle('transfer:queueUpload', (_, fileNames: string[]) =>
    workspaceService.queueUpload(fileNames)
  )
  ipcMain.handle('transfer:uploadFile', (event, tabId: string, localPath: string, remoteDirectory: string) =>
    workspaceService.uploadFile(tabId, localPath, remoteDirectory, event.sender)
  )
  ipcMain.handle('transfer:downloadFile', (event, tabId: string, remotePath: string, localDirectory: string) =>
    workspaceService.downloadFile(tabId, remotePath, localDirectory, event.sender)
  )
  ipcMain.handle('terminal:write', (_, tabId: string, data: string) =>
    workspaceService.writeToTerminal(tabId, data)
  )
  ipcMain.handle('terminal:resize', (_, tabId: string, cols: number, rows: number) =>
    workspaceService.resizeTerminal(tabId, cols, rows)
  )
  ipcMain.handle('remoteFiles:openPath', (_, tabId: string, targetPath: string) =>
    workspaceService.openRemotePath(tabId, targetPath)
  )
  ipcMain.handle('remoteFiles:readFile', (_, tabId: string, targetPath: string) =>
    workspaceService.readRemoteFile(tabId, targetPath)
  )
  ipcMain.handle('remoteFiles:writeFile', (_, tabId: string, targetPath: string, content: string) =>
    workspaceService.writeRemoteFile(tabId, targetPath, content)
  )
}
