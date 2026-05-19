import { BrowserWindow } from 'electron'
import { FileProfileRepository } from '../services/file-profile-repository.js'
import { LocalFilesService } from '../services/local-files-service.js'
import { WorkspaceService, seedCommandFolders, seedCommandTemplates, seedProfiles } from '../services/workspace-service.js'
import { registerAppHandlers } from './app-handlers.js'
import { registerLocalFilesHandlers } from './local-files-handlers.js'
import { registerRemoteFilesHandlers } from './remote-files-handlers.js'
import { registerTerminalHandlers } from './terminal-handlers.js'
import { registerTransferHandlers } from './transfer-handlers.js'
import type { IpcServices, IpcWindowOptions } from './types.js'
import { registerWorkspaceHandlers } from './workspace-handlers.js'

export function registerIpcHandlers(userDataPath: string, options: IpcWindowOptions) {
  const services: IpcServices = {
    workspaceService: new WorkspaceService(
      new FileProfileRepository(userDataPath, seedProfiles, seedCommandTemplates, seedCommandFolders)
    ),
    localFilesService: new LocalFilesService(),
    broadcastSnapshot(snapshot) {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) {
          try {
            window.webContents.send('workspace:snapshot', snapshot)
          } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('Render frame was disposed')) {
              throw error
            }
          }
        }
      }
    }
  }

  registerAppHandlers(options)
  registerWorkspaceHandlers(services, options)
  registerLocalFilesHandlers(services)
  registerTransferHandlers(services)
  registerTerminalHandlers(services)
  registerRemoteFilesHandlers(services)
}
