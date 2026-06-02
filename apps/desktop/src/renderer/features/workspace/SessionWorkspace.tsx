import { useEffect, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import type {
  CommandExecutionOptions,
  CommandFolder,
  CommandTemplate,
  LocalFileItem,
  RemoteFileItem,
  SessionSnapshot,
  WorkspaceTab
} from '@termdock/core'
import { TerminalView } from '../../components/TerminalView'
import { FileManager } from '../files/FileManager'

export function SessionWorkspace({
  activeTab,
  activeSession,
  tabs,
  localItems,
  localPath,
  canPasteToLocal,
  canPasteToRemote,
  clipboardStatusText,
  localCutPaths,
  remoteCutPaths,
  commandFolders,
  commandTemplates,
  isBusy,
  onCopyItems,
  onCutItems,
  onClearCutState,
  onExecuteCommand,
  onOpenCommandManager,
  onOpenLocalItem,
  onOpenLocalPath,
  onOpenRemoteItem,
  onOpenRemotePath,
  onPasteIntoPane,
  onRequestChangePermissions,
  onRequestDelete,
  onRequestNewFile,
  onRequestNewFolder,
  onRequestQuickDelete,
  onRequestRename,
  onToggleRemoteFileAccessMode,
  remoteFileAccessMode,
  onRefresh,
  onUploadFiles,
  onChooseUploadFiles,
  onDownloadFiles,
  onDropUpload
}: {
  activeTab: WorkspaceTab
  activeSession: SessionSnapshot
  tabs: WorkspaceTab[]
  localItems: LocalFileItem[]
  localPath: string
  canPasteToLocal: boolean
  canPasteToRemote: boolean
  clipboardStatusText: string | null
  localCutPaths: string[]
  remoteCutPaths: string[]
  commandFolders: CommandFolder[]
  commandTemplates: CommandTemplate[]
  isBusy: boolean
  onCopyItems(pane: 'local' | 'remote', items: Array<LocalFileItem | RemoteFileItem>): void
  onCutItems(pane: 'local' | 'remote', items: Array<LocalFileItem | RemoteFileItem>): void
  onClearCutState(): void
  onExecuteCommand(commandId: string, args: string[], options: CommandExecutionOptions, scope: 'current' | 'all-ssh'): void
  onOpenCommandManager(): void
  onOpenLocalItem(item: LocalFileItem): void
  onOpenLocalPath(path: string): void
  onOpenRemoteItem(item: RemoteFileItem): void
  onOpenRemotePath(path: string): void
  onPasteIntoPane(pane: 'local' | 'remote'): void
  onRequestChangePermissions(pane: 'local' | 'remote', item: LocalFileItem | RemoteFileItem): void
  onRequestDelete(pane: 'local' | 'remote', items: Array<LocalFileItem | RemoteFileItem>): void
  onRequestNewFile(pane: 'local' | 'remote', directoryPath: string): void
  onRequestNewFolder(pane: 'local' | 'remote', directoryPath: string): void
  onRequestQuickDelete(pane: 'local' | 'remote', items: Array<LocalFileItem | RemoteFileItem>): void
  onRequestRename(pane: 'local' | 'remote', item: LocalFileItem | RemoteFileItem): void
  onToggleRemoteFileAccessMode(): void
  remoteFileAccessMode: 'user' | 'root'
  onRefresh(): void
  onUploadFiles(items: LocalFileItem[]): void
  onChooseUploadFiles(): void
  onDownloadFiles(items: RemoteFileItem[], targetDirectory?: string): void
  onDropUpload(event: DragEvent<HTMLDivElement>): void
}) {
  const isFileOnly = activeTab.layout === 'file-only'
  const [filePanelHeight, setFilePanelHeight] = useState(218)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const isResizingFilePanel = useRef(false)
  const hasAlignedFilePanel = useRef(false)
  const hasUserResizedFilePanel = useRef(false)

  const clampFilePanelHeight = (workspaceHeight: number, nextHeight: number) => {
    const maxHeight = Math.max(140, workspaceHeight - 160)
    return Math.min(maxHeight, Math.max(140, nextHeight))
  }

  const syncFilePanelHeight = (mode: 'align' | 'clamp') => {
    if (isFileOnly || !workspaceRef.current || isResizingFilePanel.current) {
      return
    }

    const workspaceRect = workspaceRef.current.getBoundingClientRect()
    if (workspaceRect.height <= 0) {
      return
    }

    if (mode === 'align' && !hasUserResizedFilePanel.current) {
      const diskHeadRect = document.querySelector('.disk-head')?.getBoundingClientRect()
      if (diskHeadRect) {
        const nextHeight = workspaceRect.bottom - diskHeadRect.top
        const clampedHeight = clampFilePanelHeight(workspaceRect.height, nextHeight)
        if (nextHeight >= 140) {
          setFilePanelHeight((prev) => prev === clampedHeight ? prev : clampedHeight)
          hasAlignedFilePanel.current = true
          return
        }
      }
    }

    setFilePanelHeight((prev) => {
      const clampedHeight = clampFilePanelHeight(workspaceRect.height, prev)
      return prev === clampedHeight ? prev : clampedHeight
    })
  }

  useEffect(() => {
    if (isFileOnly) {
      return
    }

    const onMouseMove = (event: globalThis.MouseEvent) => {
      if (!isResizingFilePanel.current || !workspaceRef.current) {
        return
      }

      const rect = workspaceRef.current.getBoundingClientRect()
      const nextHeight = rect.bottom - event.clientY
      setFilePanelHeight(clampFilePanelHeight(rect.height, nextHeight))
    }

    const onMouseUp = () => {
      isResizingFilePanel.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isFileOnly])

  useEffect(() => {
    hasAlignedFilePanel.current = false
    hasUserResizedFilePanel.current = false
  }, [activeTab.id])

  useEffect(() => {
    if (isFileOnly || hasAlignedFilePanel.current) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      syncFilePanelHeight('align')
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isFileOnly, activeTab.id])

  useEffect(() => {
    if (isFileOnly || !workspaceRef.current) {
      return
    }

    const syncAfterLayout = () => {
      window.requestAnimationFrame(() => {
        syncFilePanelHeight(hasUserResizedFilePanel.current ? 'clamp' : 'align')
      })
    }

    const resizeObserver = new ResizeObserver(() => {
      syncAfterLayout()
    })
    resizeObserver.observe(workspaceRef.current)

    window.addEventListener('resize', syncAfterLayout)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', syncAfterLayout)
    }
  }, [isFileOnly, activeTab.id])

  return (
    <section
      className={`session-workspace ${isFileOnly ? 'file-only' : ''}`}
      ref={workspaceRef}
      style={{ '--file-panel-height': `${filePanelHeight}px` } as CSSProperties}
    >
      {!isFileOnly ? (
        <div className="terminal-area">
          <TerminalView key={activeTab.id} tabId={activeTab.id} bootText={activeSession.terminalTranscript ?? ''} />
        </div>
      ) : null}
      {!isFileOnly ? (
        <div
          className="session-split-resizer"
          onMouseDown={() => {
            isResizingFilePanel.current = true
            hasUserResizedFilePanel.current = true
            document.body.style.cursor = 'row-resize'
            document.body.style.userSelect = 'none'
          }}
          role="separator"
        />
      ) : null}
      <FileManager
        activeSession={activeSession}
        activeTab={activeTab}
        tabs={tabs}
        commandFolders={commandFolders}
        commandTemplates={commandTemplates}
        isBusy={isBusy}
        localItems={localItems}
        localPath={localPath}
        canPasteToLocal={canPasteToLocal}
        canPasteToRemote={canPasteToRemote}
        clipboardStatusText={clipboardStatusText}
        localCutPaths={localCutPaths}
        remoteCutPaths={remoteCutPaths}
        onCopyItems={onCopyItems}
        onCutItems={onCutItems}
        onClearCutState={onClearCutState}
        onExecuteCommand={onExecuteCommand}
        onOpenCommandManager={onOpenCommandManager}
        onOpenLocalItem={onOpenLocalItem}
        onOpenLocalPath={onOpenLocalPath}
        onOpenRemoteItem={onOpenRemoteItem}
        onOpenRemotePath={onOpenRemotePath}
        onPasteIntoPane={onPasteIntoPane}
        onRequestChangePermissions={onRequestChangePermissions}
        onRequestDelete={onRequestDelete}
        onRequestNewFile={onRequestNewFile}
        onRequestNewFolder={onRequestNewFolder}
        onRequestQuickDelete={onRequestQuickDelete}
        onRequestRename={onRequestRename}
        onToggleRemoteFileAccessMode={onToggleRemoteFileAccessMode}
        remoteFileAccessMode={remoteFileAccessMode}
        onRefresh={onRefresh}
        onUploadFiles={onUploadFiles}
        onChooseUploadFiles={onChooseUploadFiles}
        onDownloadFiles={onDownloadFiles}
        onDropUpload={onDropUpload}
      />
    </section>
  )
}
