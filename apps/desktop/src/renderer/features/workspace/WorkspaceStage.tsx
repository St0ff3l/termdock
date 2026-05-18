import type {
  ConnectionFolder,
  ConnectionProfile,
  LocalFileItem,
  RemoteFileItem,
  SessionSnapshot,
  WorkspaceTab
} from '@termdock/core'
import type { DragEvent } from 'react'
import { SystemInfoWorkspace } from '../system/SystemInfoWorkspace'
import { HomeWorkspace } from './HomeWorkspace'
import { SessionWorkspace } from './SessionWorkspace'

type ActiveLocalTab = {
  kind: 'home' | 'system'
  sessionTabId?: string
} | null

export function WorkspaceStage({
  activeLocalTab,
  activeProfile,
  activeSession,
  activeTab,
  folders,
  localItems,
  localPath,
  profiles,
  onChooseUploadFiles,
  onDownloadFiles,
  onDropUpload,
  onOpenLocalItem,
  onOpenLocalPath,
  onOpenProfile,
  onOpenRemoteItem,
  onOpenRemotePath,
  onRefresh,
  onUploadFiles
}: {
  activeLocalTab: ActiveLocalTab
  activeProfile: ConnectionProfile | null
  activeSession: SessionSnapshot | null
  activeTab: WorkspaceTab | null
  folders: ConnectionFolder[]
  localItems: LocalFileItem[]
  localPath: string
  profiles: ConnectionProfile[]
  onChooseUploadFiles(): void
  onDownloadFiles(items: RemoteFileItem[], targetDirectory?: string): void
  onDropUpload(event: DragEvent<HTMLDivElement>): void
  onOpenLocalItem(item: LocalFileItem): void
  onOpenLocalPath(path: string): void
  onOpenProfile(profileId: string): void
  onOpenRemoteItem(item: RemoteFileItem): void
  onOpenRemotePath(path: string): void
  onRefresh(): void
  onUploadFiles(items: LocalFileItem[]): void
}) {
  if (activeLocalTab?.kind === 'system') {
    return <SystemInfoWorkspace activeProfile={activeProfile} activeSession={activeSession} />
  }

  if (activeTab && activeSession && !activeLocalTab) {
    return (
      <SessionWorkspace
        activeSession={activeSession}
        activeTab={activeTab}
        localItems={localItems}
        localPath={localPath}
        onChooseUploadFiles={onChooseUploadFiles}
        onDownloadFiles={onDownloadFiles}
        onDropUpload={onDropUpload}
        onOpenLocalItem={onOpenLocalItem}
        onOpenLocalPath={onOpenLocalPath}
        onOpenRemoteItem={onOpenRemoteItem}
        onOpenRemotePath={onOpenRemotePath}
        onRefresh={onRefresh}
        onUploadFiles={onUploadFiles}
      />
    )
  }

  return (
    <HomeWorkspace
      folders={folders}
      onOpen={onOpenProfile}
      profiles={profiles}
    />
  )
}
