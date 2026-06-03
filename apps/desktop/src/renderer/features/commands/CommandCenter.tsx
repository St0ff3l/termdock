import { useEffect, useMemo, useState, useRef } from 'react'
import type {
  CommandExecutionOptions,
  CommandFolder,
  CommandTemplate,
  WorkspaceTab
} from '@termdock/core'
import { t } from '../../i18n'
import { AppIcon } from '../common/AppIcon'
import { handleHorizontalWheelScroll } from '../common/horizontal-scroll'
import { extractCommandParams, groupCommands, sortByOrder } from './command-utils'

type SendScope = 'current' | 'all-ssh'

function getCommandSnippet(command: string) {
  return command
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

function getCommandSummary(template: CommandTemplate) {
  return template.description?.trim() || getCommandSnippet(template.command) || t.commandNoDescription
}

export function CommandCenter({
  activeTab,
  commandFolders,
  commandTemplates,
  isBusy,
  tabs,
  onExecute,
  paneWidth,
  onPaneWidthChange,
}: {
  activeTab: WorkspaceTab | null
  commandFolders: CommandFolder[]
  commandTemplates: CommandTemplate[]
  isBusy: boolean
  tabs: WorkspaceTab[]
  onExecute(commandId: string, args: string[], options: CommandExecutionOptions, scope: SendScope): void
  paneWidth: number
  onPaneWidthChange(width: number): void
}) {
  const grouped = useMemo(() => groupCommands(commandFolders, commandTemplates), [commandFolders, commandTemplates])
  const ungrouped = useMemo(
    () => sortByOrder(commandTemplates.filter((template) => !template.parentId)),
    [commandTemplates]
  )
  const sshTabs = useMemo(
    () => tabs.filter((tab) => tab.sessionType === 'ssh' && tab.status !== 'closed'),
    [tabs]
  )
  const [activeFolderId, setActiveFolderId] = useState<string>('all')
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(commandTemplates[0]?.id ?? null)
  const [paramValues, setParamValues] = useState<Record<number, string>>({})
  const [lastRenderedCommand, setLastRenderedCommand] = useState('')
  const [appendCarriageReturn, setAppendCarriageReturn] = useState(true)
  const [sendScope, setSendScope] = useState<SendScope>('current')
  
  const splitRef = useRef<HTMLDivElement | null>(null)
  const isResizingCommandSplit = useRef(false)

  const visibleTemplates = useMemo(() => {
    if (activeFolderId === 'all') {
      return sortByOrder(commandTemplates)
    }
    if (activeFolderId === 'ungrouped') {
      return ungrouped
    }
    return sortByOrder(commandTemplates.filter((template) => template.parentId === activeFolderId))
  }, [activeFolderId, commandTemplates, ungrouped])

  const selectedTemplate = useMemo(
    () => visibleTemplates.find((template) => template.id === selectedCommandId)
      ?? commandTemplates.find((template) => template.id === selectedCommandId)
      ?? visibleTemplates[0]
      ?? null,
    [commandTemplates, selectedCommandId, visibleTemplates]
  )
  const paramIndexes = selectedTemplate ? extractCommandParams(selectedTemplate.command) : []
  const canRunCurrent = Boolean(activeTab && activeTab.sessionType === 'ssh' && selectedTemplate)
  const canRunAny = Boolean(sshTabs.length && selectedTemplate)

  useEffect(() => {
    if (!selectedTemplate && commandTemplates[0]) {
      setSelectedCommandId(commandTemplates[0].id)
    }
  }, [commandTemplates, selectedTemplate])

  useEffect(() => {
    setParamValues({})
    setAppendCarriageReturn(selectedTemplate?.appendCarriageReturn ?? true)
    setLastRenderedCommand('')
  }, [selectedTemplate?.id])

  const handleRun = () => {
    if (!selectedTemplate) {
      return
    }
    const args = paramIndexes.map((index) => paramValues[index] ?? '')
    const rendered = selectedTemplate.command.replace(/\[p#(\d+)\]/g, (_, rawIndex: string) => args[Number(rawIndex) - 1] ?? '')
    setLastRenderedCommand(rendered)
    onExecute(selectedTemplate.id, args, { appendCarriageReturn }, sendScope)
  }

  useEffect(() => {
    let dragFrame: number | null = null

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (!isResizingCommandSplit.current || !splitRef.current) return

      const rect = splitRef.current.getBoundingClientRect()
      const minListWidth = 180
      const minPreviewWidth = 320
      const maxListWidth = Math.max(minListWidth, rect.width - minPreviewWidth - 6)
      const nextWidth = Math.min(maxListWidth, Math.max(minListWidth, event.clientX - rect.left))
      
      if (dragFrame) {
        window.cancelAnimationFrame(dragFrame)
      }
      
      dragFrame = window.requestAnimationFrame(() => {
        onPaneWidthChange(nextWidth)
      })
    }

    const handleMouseUp = () => {
      if (!isResizingCommandSplit.current) return
      isResizingCommandSplit.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      if (dragFrame) {
        window.cancelAnimationFrame(dragFrame)
      }
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [onPaneWidthChange])

  return (
    <section className="command-center">
      <div 
        className="command-center-body" 
        ref={splitRef}
        style={{ '--list-pane-width': `${paneWidth}px` } as React.CSSProperties}
      >
        <section className="command-pane command-pane-list">
          <div className="command-folder-bar">
            <div
              className="command-folder-tabs"
              onWheel={handleHorizontalWheelScroll}
            >
              <button
                className={activeFolderId === 'all' ? 'active' : ''}
                type="button"
                onClick={() => setActiveFolderId('all')}
              >
                <span>{t.all}</span>
                <small>{commandTemplates.length}</small>
              </button>
              {grouped.map(({ folder, templates }) => (
                <button
                  key={folder.id}
                  className={activeFolderId === folder.id ? 'active' : ''}
                  type="button"
                  onClick={() => setActiveFolderId(folder.id)}
                >
                  <span>{folder.name}</span>
                  <small>{templates.length}</small>
                </button>
              ))}
              {ungrouped.length ? (
                <button
                  className={activeFolderId === 'ungrouped' ? 'active' : ''}
                  type="button"
                  onClick={() => setActiveFolderId('ungrouped')}
                >
                  <span>{t.commandUncategorized}</span>
                  <small>{ungrouped.length}</small>
                </button>
              ) : null}
            </div>
          </div>

          <div className="command-template-list scrollbar-scroll">
            <table className="fs-file-table compact command-table">
              <colgroup>
                <col style={{ width: '100%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-name">{t.name}</th>
                </tr>
              </thead>
              <tbody>
                {visibleTemplates.map((template) => (
                  <tr
                    key={template.id}
                    className={selectedTemplate?.id === template.id ? 'is-selected' : ''}
                    onClick={() => setSelectedCommandId(template.id)}
                  >
                    <td className="col-name">
                      <span className="command-icon">
                        <AppIcon name="flash" size={14} />
                      </span>
                      <strong>{template.name}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!visibleTemplates.length ? (
              <div className="command-empty-state">{t.commandEmpty}</div>
            ) : null}
          </div>
        </section>

        <div
          className="file-split-resizer"
          onMouseDown={() => {
            isResizingCommandSplit.current = true
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
          role="separator"
        />

        <section className="command-pane command-pane-preview">
          <div className="command-pane-head">
            <strong>{t.commandPreview}</strong>
            <span>{selectedTemplate ? t.commandRendered : t.commandNoDescription}</span>
          </div>

          <div className="command-runner scrollbar-scroll">
            {selectedTemplate ? (
              <>
                <div className="command-runner-head">
                  <strong>{selectedTemplate.name}</strong>
                  <div className="command-runner-actions">
                    <label className="command-target-select command-target-select-inline">
                      <span>{t.commandSendScope}</span>
                      <select value={sendScope} onChange={(event) => setSendScope(event.currentTarget.value as SendScope)}>
                        <option value="current">{t.commandSendCurrent}</option>
                        <option value="all-ssh">{t.commandSendAll}</option>
                      </select>
                    </label>
                    <button type="button" className="primary-button" onClick={handleRun} disabled={isBusy || (sendScope === 'current' ? !canRunCurrent : !canRunAny)}>
                      <AppIcon name="flash" />
                      {t.send}
                    </button>
                  </div>
                </div>
                <div className="command-detail-block">
                  <span>{t.name}</span>
                  <p>{selectedTemplate.name}</p>
                </div>
                <div className="command-detail-block">
                  <span>{t.description}</span>
                  <p>{selectedTemplate.description || t.commandNoDescription}</p>
                </div>
                <div className="command-preview command-detail-block">
                  <span>{t.commandTemplate}</span>
                  <code>{selectedTemplate.command}</code>
                </div>
                {paramIndexes.length ? (
                  <div className="command-param-grid">
                    {paramIndexes.map((index) => (
                      <label key={index}>
                        <span>{`${t.commandParam} ${index}`}</span>
                        <input
                          type="text"
                          value={paramValues[index] ?? ''}
                          onChange={(event) => {
                            const value = event.currentTarget.value
                            setParamValues((prev) => ({ ...prev, [index]: value }))
                          }}
                        />
                      </label>
                    ))}
                  </div>
                ) : null}
                <div className="command-preview command-detail-block">
                  <span>{t.commandRendered}</span>
                  <code>{lastRenderedCommand || selectedTemplate.command}</code>
                </div>
                <div className="command-runner-controls">
                  <label className="command-toggle">
                    <input
                      checked={appendCarriageReturn}
                      type="checkbox"
                      onChange={(event) => setAppendCarriageReturn(event.currentTarget.checked)}
                    />
                    <span>{t.commandAppendCr}</span>
                  </label>
                </div>
              </>
            ) : (
              <div className="command-empty-state">{t.commandEmpty}</div>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
