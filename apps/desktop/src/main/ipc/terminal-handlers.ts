import { clipboard, ipcMain } from 'electron'
import type { IpcServices } from './types.js'

export function registerTerminalHandlers(services: IpcServices) {
  const { workspaceService } = services

  ipcMain.handle('app:readClipboardText', () => clipboard.readText())

  ipcMain.handle('app:writeClipboardText', (_event, text: string) => {
    clipboard.writeText(text)
  })

  ipcMain.handle('terminal:write', (_, tabId: string, data: string) =>
    workspaceService.writeToTerminal(tabId, data)
  )

  ipcMain.handle('terminal:resize', (_, tabId: string, cols: number, rows: number, width: number, height: number) =>
    workspaceService.resizeTerminal(tabId, cols, rows, width, height)
  )
}
