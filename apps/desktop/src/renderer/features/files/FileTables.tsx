import type { DragEvent, FormEvent, MouseEvent } from 'react'
import type { LocalFileItem, RemoteFileItem } from '@termdock/core'
import { t } from '../../i18n'
import { AppIcon } from '../common/AppIcon'

export function PanePathBar({
  hint,
  label,
  value,
  onChange,
  onSubmit
}: {
  hint?: string
  label: string
  value: string
  onChange(value: string): void
  onSubmit(event: FormEvent<HTMLFormElement>): void
}) {
  return (
    <form className="pane-path-bar" onSubmit={onSubmit}>
      <strong>{label}</strong>
      <input
        aria-label={`${label}路径`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span>{hint}</span> : null}
    </form>
  )
}

export function FileTable({
  rows,
  compact = false,
  cutPaths,
  selectedPaths,
  onClearSelection,
  onContextItem,
  onDragItem,
  onOpenItem,
  onSelectItem,
  onSelectionDragEnter,
  onSelectionDragStart
}: {
  rows: RemoteFileItem[]
  compact?: boolean
  cutPaths?: string[]
  selectedPaths?: string[]
  onClearSelection?(): void
  onContextItem?(event: MouseEvent<HTMLTableRowElement>, item: RemoteFileItem): void
  onDragItem?(event: DragEvent<HTMLElement>, item: RemoteFileItem): void
  onOpenItem?(item: RemoteFileItem): void
  onSelectItem?(event: MouseEvent<HTMLTableRowElement>, item: RemoteFileItem): void
  onSelectionDragEnter?(item: RemoteFileItem): void
  onSelectionDragStart?(event: MouseEvent<HTMLTableRowElement>, item: RemoteFileItem): void
}) {
  return (
    <table
      className={`fs-file-table ${compact ? 'compact' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClearSelection?.()
        }
      }}
    >
      <thead>
        <tr>
          <th>{t.fileName}</th>
          {!compact ? <th>{t.size}</th> : null}
          {!compact ? <th>{t.type}</th> : null}
          {!compact ? <th>{t.modifiedAt}</th> : null}
          {!compact ? <th>{t.permission}</th> : null}
          {!compact ? <th>{t.ownerGroup}</th> : null}
        </tr>
      </thead>
      <tbody onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClearSelection?.()
        }
      }}>
        {rows.length ? rows.map((row) => (
          <tr
            key={row.path}
            className={`${row.type === 'folder' ? 'is-folder' : 'is-file'} ${selectedPaths?.includes(row.path) ? 'is-selected' : ''} ${cutPaths?.includes(row.path) ? 'is-cut-pending' : ''}`}
            onClick={(event) => onSelectItem?.(event, row)}
            onContextMenu={(event) => onContextItem?.(event, row)}
            onDoubleClick={() => onOpenItem?.(row)}
            onMouseDown={(event) => {
              if (event.button === 0) {
                onSelectionDragStart?.(event, row)
              }
            }}
            onMouseEnter={() => onSelectionDragEnter?.(row)}
          >
            <td>
              <span
                className={`file-icon ${row.type === 'file' ? 'is-draggable' : ''}`}
                draggable={row.type === 'file'}
                onDragStart={(event) => onDragItem?.(event, row)}
                onMouseDown={(event) => event.stopPropagation()}
                title={row.type === 'file' ? t.dragTransfer : undefined}
              >
                <AppIcon name={row.type === 'folder' ? 'folder' : 'file'} />
              </span>
              {row.name}
            </td>
            {!compact ? <td>{row.size}</td> : null}
            {!compact ? <td>{row.type === 'folder' ? t.folder : row.type}</td> : null}
            {!compact ? <td>{row.modified}</td> : null}
            {!compact ? <td>{row.permission ?? ''}</td> : null}
            {!compact ? <td>{row.ownerGroup ?? ''}</td> : null}
          </tr>
        )) : (
          <tr><td colSpan={compact ? 1 : 6}>{t.emptyFiles}</td></tr>
        )}
      </tbody>
    </table>
  )
}

export function LocalFileTable({
  cutPaths,
  rows,
  selectedPaths,
  onClearSelection,
  onContextItem,
  onDragItem,
  onOpenItem,
  onSelectItem,
  onSelectionDragEnter,
  onSelectionDragStart
}: {
  cutPaths?: string[]
  rows: LocalFileItem[]
  selectedPaths: string[]
  onClearSelection(): void
  onContextItem(event: MouseEvent<HTMLTableRowElement>, item: LocalFileItem): void
  onDragItem(event: DragEvent<HTMLElement>, item: LocalFileItem): void
  onOpenItem(item: LocalFileItem): void
  onSelectItem(event: MouseEvent<HTMLTableRowElement>, item: LocalFileItem): void
  onSelectionDragEnter(item: LocalFileItem): void
  onSelectionDragStart(event: MouseEvent<HTMLTableRowElement>, item: LocalFileItem): void
}) {
  return (
    <table
      className="fs-file-table compact"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClearSelection()
        }
      }}
    >
      <thead>
        <tr>
          <th>{t.fileName}</th>
        </tr>
      </thead>
      <tbody onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClearSelection()
        }
      }}>
        {rows.map((row) => (
          <tr
            key={`${row.path}:${row.name}`}
            className={`${row.type === 'folder' ? 'is-folder' : 'is-file'} ${selectedPaths.includes(row.path) ? 'is-selected' : ''} ${cutPaths?.includes(row.path) ? 'is-cut-pending' : ''}`}
            onClick={(event) => onSelectItem(event, row)}
            onContextMenu={(event) => onContextItem(event, row)}
            onDoubleClick={() => onOpenItem(row)}
            onMouseDown={(event) => {
              if (event.button === 0) {
                onSelectionDragStart(event, row)
              }
            }}
            onMouseEnter={() => onSelectionDragEnter(row)}
          >
            <td>
              <span
                className={`file-icon ${row.name !== '..' ? 'is-draggable' : ''}`}
                draggable={row.name !== '..'}
                onDragStart={(event) => onDragItem(event, row)}
                onMouseDown={(event) => event.stopPropagation()}
                title={row.name !== '..' ? t.dragTransfer : undefined}
              >
                <AppIcon name={row.type === 'folder' ? 'folder' : 'file'} />
              </span>
              {row.name}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
