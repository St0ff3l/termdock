import { useEffect, useMemo, useState } from 'react'
import type { CommandFolder, CommandTemplate, WorkspaceTab } from '@termdock/core'
import { t } from '../../i18n'
import { AppIcon } from '../common/AppIcon'
import { extractCommandParams, groupCommands, sortByOrder } from './command-utils'

export function CommandCenter({
  activeTab,
  commandFolders,
  commandTemplates,
  isBusy,
  onExecute,
  onOpenManager
}: {
  activeTab: WorkspaceTab | null
  commandFolders: CommandFolder[]
  commandTemplates: CommandTemplate[]
  isBusy: boolean
  onExecute(commandId: string, args: string[]): void
  onOpenManager(): void
}) {
  const grouped = useMemo(() => groupCommands(commandFolders, commandTemplates), [commandFolders, commandTemplates])
  const ungrouped = useMemo(
    () => sortByOrder(commandTemplates.filter((template) => !template.parentId)),
    [commandTemplates]
  )
  const [activeFolderId, setActiveFolderId] = useState<string>('all')
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(commandTemplates[0]?.id ?? null)
  const [paramValues, setParamValues] = useState<Record<number, string>>({})
  const [lastRenderedCommand, setLastRenderedCommand] = useState('')

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
  const canRun = Boolean(activeTab && activeTab.sessionType === 'ssh' && selectedTemplate)

  useEffect(() => {
    if (!selectedTemplate && commandTemplates[0]) {
      setSelectedCommandId(commandTemplates[0].id)
    }
  }, [commandTemplates, selectedTemplate])

  useEffect(() => {
    setParamValues({})
  }, [selectedTemplate?.id])

  const handleRun = () => {
    if (!selectedTemplate) {
      return
    }
    const args = paramIndexes.map((index) => paramValues[index] ?? '')
    const rendered = selectedTemplate.command.replace(/\[p#(\d+)\]/g, (_, rawIndex: string) => args[Number(rawIndex) - 1] ?? '')
    setLastRenderedCommand(rendered)
    onExecute(selectedTemplate.id, args)
  }

  return (
    <section className="command-center">
      <div className="command-center-topbar">
        <div>
          <strong>{t.commandQuickLaunch}</strong>
          <span>{activeTab?.sessionType === 'ssh' ? t.commandSendToCurrentSession : t.commandSshOnly}</span>
        </div>
        <div className="command-center-actions">
          <button type="button" onClick={onOpenManager}>{t.commandManager}</button>
        </div>
      </div>

      <div className="command-center-body">
        <aside className="command-folder-list">
          <button
            className={activeFolderId === 'all' ? 'active' : ''}
            type="button"
            onClick={() => setActiveFolderId('all')}
          >
            {t.all}
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
        </aside>

        <div className="command-template-list">
          {visibleTemplates.map((template) => (
            <button
              key={template.id}
              className={`command-template-card ${selectedTemplate?.id === template.id ? 'active' : ''}`}
              type="button"
              onClick={() => setSelectedCommandId(template.id)}
            >
              <div className="command-template-head">
                <strong>{template.name}</strong>
                <span>{extractCommandParams(template.command).length ? t.commandWithParams : t.commandDirectRun}</span>
              </div>
              <code>{template.command}</code>
              <p>{template.description || t.commandNoDescription}</p>
            </button>
          ))}
          {!visibleTemplates.length ? (
            <div className="command-empty-state">{t.commandEmpty}</div>
          ) : null}
        </div>

        <div className="command-runner">
          {selectedTemplate ? (
            <>
              <div className="command-runner-head">
                <strong>{selectedTemplate.name}</strong>
                <button type="button" onClick={handleRun} disabled={!canRun || isBusy}>
                  <AppIcon name="flash" />
                  {t.send}
                </button>
              </div>
              <p>{selectedTemplate.description || t.commandNoDescription}</p>
              <div className="command-preview">
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
              <div className="command-preview">
                <span>{t.commandRendered}</span>
                <code>{lastRenderedCommand || selectedTemplate.command}</code>
              </div>
              <div className="command-runner-meta">
                <span>{selectedTemplate.appendCarriageReturn ? t.commandAppendCr : t.commandNoCr}</span>
                <span>{canRun ? t.commandReady : t.commandSshOnly}</span>
              </div>
            </>
          ) : (
            <div className="command-empty-state">{t.commandEmpty}</div>
          )}
        </div>
      </div>
    </section>
  )
}
