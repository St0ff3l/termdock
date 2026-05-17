import type { ConnectionProfile, ConnectionFolder } from '@termdock/core'
import { useState, useMemo, type MouseEvent, type DragEvent } from 'react'

export function ConnectionManagerModal({
  profiles,
  folders,
  onClose,
  onCreate,
  onDeleteProfile,
  onEditProfile,
  onOpenProfile,
  onCreateFolder,
  onDeleteFolder,
  onUpdateFolder,
  onUpdateOrder,
  standalone = false
}: {
  profiles: ConnectionProfile[]
  folders: ConnectionFolder[]
  onClose(): void
  onCreate(): void
  onDeleteProfile(event: MouseEvent<HTMLButtonElement>, profileId: string): void
  onEditProfile(profile: ConnectionProfile): void
  onOpenProfile(profileId: string): void
  onCreateFolder(name: string): void
  onDeleteFolder(folderId: string): void
  onUpdateFolder(folderId: string, updates: Partial<ConnectionFolder>): void
  onUpdateOrder(id: string, newParentId: string | undefined, newOrder: number): void
  standalone?: boolean
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dragPosition, setDragPosition] = useState<'top' | 'bottom' | 'inside' | null>(null)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  const toggleFolder = (folderId: string, event?: React.MouseEvent) => {
    event?.stopPropagation()
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  // Build tree
  const tree = useMemo(() => {
    type Node = (ConnectionProfile | ConnectionFolder) & { children?: Node[] }
    const items: Node[] = [...profiles, ...folders]
    // Ensure all have order
    items.forEach((item, index) => {
      if (typeof item.order !== 'number') item.order = index * 1000
    })

    const roots: Node[] = []
    const map = new Map<string, Node>()

    items.forEach(item => {
      if (item.type === 'folder') {
        ;(item as Node).children = []
      }
      map.set(item.id, item as Node)
    })

    items.forEach(item => {
      if (item.parentId && map.has(item.parentId)) {
        const parent = map.get(item.parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(item as Node)
      } else {
        roots.push(item as Node)
      }
    })

    const sortNodes = (nodes: Node[]) => {
      nodes.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      nodes.forEach(n => {
        if (n.children) sortNodes(n.children)
      })
    }
    sortNodes(roots)
    return { roots, map }
  }, [profiles, folders])

  const handleDragStart = (e: DragEvent, id: string) => {
    e.stopPropagation()
    setDraggingId(id)
    e.dataTransfer.effectAllowed = 'move'
    // For firefox
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: DragEvent, targetId: string, type: 'folder' | 'profile') => {
    e.preventDefault()
    e.stopPropagation()
    if (draggingId === targetId) return

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    let pos: 'top' | 'bottom' | 'inside' = 'bottom'
    if (type === 'folder') {
      if (y < height * 0.25) pos = 'top'
      else if (y > height * 0.75) pos = 'bottom'
      else pos = 'inside'
    } else {
      if (y < height * 0.5) pos = 'top'
      else pos = 'bottom'
    }

    setDragOverId(targetId)
    setDragPosition(pos)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)
    setDragPosition(null)
  }

  const handleDrop = (e: DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }

    const draggedNode = tree.map.get(draggingId)
    const targetNode = tree.map.get(targetId)
    if (!draggedNode || !targetNode) return

    // Prevent dropping a folder into its own descendant
    let current = targetNode
    let invalid = false
    while (current.parentId) {
      if (current.parentId === draggingId) {
        invalid = true
        break
      }
      current = tree.map.get(current.parentId)!
    }
    if (invalid) {
      setDraggingId(null)
      setDragOverId(null)
      return
    }

    let newParentId = targetNode.parentId
    let siblings = newParentId ? tree.map.get(newParentId)!.children! : tree.roots

    let newOrder = targetNode.order ?? 0

    if (dragPosition === 'inside' && targetNode.type === 'folder') {
      newParentId = targetNode.id
      const children = targetNode.children || []
      newOrder = children.length > 0 ? (children[children.length - 1].order ?? 0) + 1000 : 1000
      // Auto expand when dropped inside
      setExpandedFolders(prev => new Set(prev).add(targetNode.id))
    } else {
      const targetIndex = siblings.findIndex(s => s.id === targetId)
      if (dragPosition === 'top') {
        const prev = siblings[targetIndex - 1]
        newOrder = prev ? ((prev.order ?? 0) + (targetNode.order ?? 0)) / 2 : (targetNode.order ?? 0) - 1000
      } else if (dragPosition === 'bottom') {
        const next = siblings[targetIndex + 1]
        newOrder = next ? ((next.order ?? 0) + (targetNode.order ?? 0)) / 2 : (targetNode.order ?? 0) + 1000
      }
    }

    onUpdateOrder(draggingId, newParentId, newOrder)
    setDraggingId(null)
    setDragOverId(null)
    setDragPosition(null)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setDragOverId(null)
    setDragPosition(null)
  }

  const renderNode = (node: any, depth: number) => {
    const isFolder = node.type === 'folder'
    const isExpanded = expandedFolders.has(node.id)
    const isDragOver = dragOverId === node.id
    const isDragging = draggingId === node.id

    let dropClass = ''
    if (isDragOver && dragPosition) {
      dropClass = `drop-${dragPosition}`
    }

    return (
      <div key={node.id}>
        <div
          className={`manager-row ${isFolder ? 'folder-row' : ''} ${dropClass} ${isDragging ? 'dragging' : ''}`}
          draggable
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={(e) => handleDragOver(e, node.id, isFolder ? 'folder' : 'profile')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, node.id)}
          onDragEnd={handleDragEnd}
          onDoubleClick={() => isFolder ? toggleFolder(node.id) : onOpenProfile(node.id)}
          onClick={() => isFolder ? toggleFolder(node.id) : onOpenProfile(node.id)}
          role="button"
          tabIndex={0}
        >
          <span style={{ paddingLeft: `${depth * 20}px`, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isFolder && (
              <span className="folder-icon" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.1s', display: 'inline-block', fontSize: '10px' }}>
                ▶
              </span>
            )}
            {!isFolder && <span style={{ width: '12px', display: 'inline-block' }}></span>}
            {node.name}
          </span>
          <span>{isFolder ? '--' : node.host}</span>
          <span>{isFolder ? '--' : node.port}</span>
          <span>{isFolder ? '--' : node.username}</span>
          <span>{isFolder ? 'FOLDER' : node.type.toUpperCase()}</span>
          <span>{isFolder ? '--' : (node.note || '/')}</span>
          <span className="manager-actions">
            {!isFolder && (
              <button
                className="flat-button compact"
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onEditProfile(node)
                }}
              >
                编辑
              </button>
            )}
            <button
              className="flat-button compact danger"
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (isFolder) onDeleteFolder(node.id)
                else onDeleteProfile(e, node.id)
              }}
            >
              删除
            </button>
          </span>
        </div>
        {isFolder && isExpanded && node.children && (
          <div className="folder-children">
            {node.children.map((child: any) => renderNode(child, depth + 1))}
            {node.children.length === 0 && (
              <div className="manager-row empty-folder" style={{ paddingLeft: `${(depth + 1) * 20 + 14}px`, color: '#666' }}>
                <span style={{ gridColumn: '1 / -1' }}>空文件夹</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const content = (
    <div className={`modal-card manager-modal ${standalone ? 'standalone' : ''}`}>
      <div className="modal-header">
        <span>连接管理器</span>
        {!standalone ? <button className="icon-button" onClick={onClose} type="button">×</button> : null}
      </div>
      <div className="manager-toolbar" style={{ gap: '10px' }}>
        <button 
          className="flat-button" 
          type="button" 
          onClick={() => {
            setIsCreatingFolder(true)
            setNewFolderName('')
          }}
        >
          新建文件夹
        </button>
        <button className="primary-button" type="button" onClick={onCreate}>新建连接</button>
      </div>
      <div className="manager-table">
        <div className="manager-head">
          <span>名称</span>
          <span>主机</span>
          <span>端口</span>
          <span>用户</span>
          <span>类型</span>
          <span>备注</span>
          <span>操作</span>
        </div>
        <div className="manager-body" style={{ flex: 1, overflowY: 'auto' }}>
          {isCreatingFolder && (
            <div className="manager-row folder-row">
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="folder-icon" style={{ display: 'inline-block', fontSize: '10px' }}>▶</span>
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFolderName.trim()) {
                      onCreateFolder(newFolderName.trim())
                      setIsCreatingFolder(false)
                    } else if (e.key === 'Escape') {
                      setIsCreatingFolder(false)
                    }
                  }}
                  onBlur={() => {
                    if (newFolderName.trim()) onCreateFolder(newFolderName.trim())
                    setIsCreatingFolder(false)
                  }}
                  style={{ background: 'var(--bg-active)', border: 'none', color: 'inherit', padding: '2px 4px', outline: 'none' }}
                  placeholder="文件夹名称"
                />
              </span>
              <span>--</span>
              <span>--</span>
              <span>--</span>
              <span>FOLDER</span>
              <span>--</span>
              <span></span>
            </div>
          )}
          {tree.roots.map((node) => renderNode(node, 0))}
          {tree.roots.length === 0 && !isCreatingFolder && (
            <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
              暂无连接
            </div>
          )}
        </div>
      </div>
    </div>
  )

  if (standalone) {
    return <div className="manager-window">{content}</div>
  }

  return (
    <div className="modal-backdrop">
      {content}
    </div>
  )
}
