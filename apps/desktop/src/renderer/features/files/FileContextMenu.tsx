import type { LocalFileItem, RemoteFileItem } from '@termdock/core'
import { t } from '../../i18n'
import { ContextMenu } from '../common/ContextMenu'

export function FileContextMenu({
  canQuickDelete,
  item,
  onClose,
  onChangePermissions,
  onCopyPath,
  onDelete,
  onDeleteFast,
  onDownload,
  onNewFile,
  onNewFolder,
  onOpen,
  onRefresh,
  onRename,
  onUpload,
  pane,
  position
}: {
  canQuickDelete: boolean
  item: LocalFileItem | RemoteFileItem | null
  onClose(): void
  onChangePermissions(): void
  onCopyPath(): void
  onDelete(): void
  onDeleteFast(): void
  onDownload(): void
  onNewFile(): void
  onNewFolder(): void
  onOpen(): void
  onRefresh(): void
  onRename(): void
  onUpload(): void
  pane: 'local' | 'remote'
  position: { x: number; y: number }
}) {
  const canDownload = pane === 'remote' && item?.type === 'file'
  const canUpload = pane === 'remote' || pane === 'local'
  const uploadLabel = t.uploadMore
  const canMutateItem = Boolean(item && item.name !== '..')
  const items = [
    { label: t.refresh, action: onRefresh },
    { separator: true },
    { label: t.open, disabled: !item, action: onOpen },
    { separator: true },
    { label: t.copyPath, disabled: !item, action: onCopyPath },
    ...(canDownload ? [{ separator: true }, { label: t.download, action: onDownload }] : []),
    ...(canUpload ? [{ separator: true }, { label: uploadLabel, action: onUpload }] : []),
    { separator: true },
    { label: t.newFolder, action: onNewFolder },
    { label: t.newFile, action: onNewFile },
    { separator: true },
    { label: t.rename, disabled: !canMutateItem, action: onRename },
    { label: t.delete, disabled: !canMutateItem, danger: true, action: onDelete },
    ...(canQuickDelete ? [{ label: t.quickDelete, disabled: !canMutateItem, danger: true, action: onDeleteFast }] : []),
    { separator: true },
    { label: t.permissionMore, disabled: !canMutateItem, action: onChangePermissions }
  ]

  return (
    <ContextMenu
      className="file-context-menu"
      items={items}
      onClose={onClose}
      position={position}
    />
  )
}
