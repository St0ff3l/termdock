import { useEffect, useMemo, useState } from 'react'
import type { CommandFolder, CommandTemplate, CommandTemplateInput } from '@termdock/core'
import { t } from '../../i18n'
import { extractCommandParams, sortByOrder } from './command-utils'

const emptyCommandForm: CommandTemplateInput = {
  name: '',
  command: '',
  description: '',
  parentId: undefined,
  appendCarriageReturn: true
}

export function CommandManagerModal({
  commandFolders,
  commandTemplates,
  onClose,
  onCreateFolder,
  onDeleteFolder,
  onCreateCommand,
  onUpdateCommand,
  onDeleteCommand,
  standalone = false
}: {
  commandFolders: CommandFolder[]
  commandTemplates: CommandTemplate[]
  onClose(): void
  onCreateFolder(name: string): void
  onDeleteFolder(folderId: string): void
  onCreateCommand(input: CommandTemplateInput): void
  onUpdateCommand(commandId: string, input: CommandTemplateInput): void
  onDeleteCommand(commandId: string): void
  standalone?: boolean
}) {
  const folders = useMemo(() => sortByOrder(commandFolders), [commandFolders])
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all')
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(commandTemplates[0]?.id ?? null)
  const [newFolderName, setNewFolderName] = useState('')
  const [form, setForm] = useState<CommandTemplateInput>(emptyCommandForm)

  const filteredCommands = useMemo(() => {
    if (selectedFolderId === 'all') {
      return sortByOrder(commandTemplates)
    }
    return sortByOrder(commandTemplates.filter((item) => item.parentId === selectedFolderId))
  }, [commandTemplates, selectedFolderId])

  const selectedCommand = useMemo(
    () => commandTemplates.find((item) => item.id === selectedCommandId) ?? null,
    [commandTemplates, selectedCommandId]
  )

  useEffect(() => {
    if (selectedCommand) {
      setForm({
        name: selectedCommand.name,
        command: selectedCommand.command,
        description: selectedCommand.description ?? '',
        parentId: selectedCommand.parentId,
        order: selectedCommand.order,
        appendCarriageReturn: selectedCommand.appendCarriageReturn
      })
      return
    }

    setForm((prev) => ({
      ...emptyCommandForm,
      parentId: selectedFolderId === 'all' ? prev.parentId : selectedFolderId
    }))
  }, [selectedCommand, selectedFolderId])

  const handleSave = () => {
    if (!form.name.trim() || !form.command.trim()) {
      return
    }

    const payload: CommandTemplateInput = {
      ...form,
      name: form.name.trim(),
      command: form.command.trim(),
      description: form.description?.trim() || undefined,
      parentId: form.parentId || undefined,
      appendCarriageReturn: form.appendCarriageReturn ?? true
    }

    if (selectedCommandId && selectedCommand) {
      onUpdateCommand(selectedCommandId, payload)
      return
    }

    onCreateCommand(payload)
  }

  const handleCreateNew = () => {
    setSelectedCommandId(null)
    setForm({
      ...emptyCommandForm,
      parentId: selectedFolderId === 'all' ? undefined : selectedFolderId
    })
  }

  const shell = (
    <div className={`modal-card command-manager-modal ${standalone ? 'standalone' : ''}`}>
      <div className="modal-header">
        <h2>{t.commandManager}</h2>
        {!standalone ? <button className="icon-button" onClick={onClose} type="button">×</button> : null}
      </div>

      <div className="command-manager-body">
        <aside className="command-manager-sidebar">
          <div className="command-manager-sidebar-head">
            <strong>{t.commandCategory}</strong>
            <button type="button" onClick={() => {
              const nextName = newFolderName.trim()
              if (!nextName) {
                return
              }
              onCreateFolder(nextName)
              setNewFolderName('')
            }}>
              {t.newFolder}
            </button>
          </div>
          <input
            placeholder={t.folderName}
            type="text"
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.currentTarget.value)}
          />
          <div className="command-folder-stack">
            <button
              className={selectedFolderId === 'all' ? 'active' : ''}
              type="button"
              onClick={() => setSelectedFolderId('all')}
            >
              {t.all}
            </button>
            {folders.map((folder) => (
              <div className="command-folder-row" key={folder.id}>
                <button
                  className={selectedFolderId === folder.id ? 'active' : ''}
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                >
                  {folder.name}
                </button>
                <button className="danger" type="button" onClick={() => onDeleteFolder(folder.id)}>
                  {t.delete}
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="command-manager-list">
          <div className="command-manager-sidebar-head">
            <strong>{t.commandList}</strong>
            <button type="button" onClick={handleCreateNew}>{t.newCommand}</button>
          </div>
          <div className="command-manager-list-shell">
            {filteredCommands.map((item) => (
              <button
                key={item.id}
                className={`command-manager-item ${selectedCommandId === item.id ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedCommandId(item.id)}
              >
                <strong>{item.name}</strong>
                <code>{item.command}</code>
              </button>
            ))}
            {!filteredCommands.length ? (
              <div className="command-empty-state">{t.commandEmpty}</div>
            ) : null}
          </div>
        </section>

        <section className="command-manager-editor">
          <div className="command-manager-sidebar-head">
            <strong>{selectedCommand ? t.edit : t.newCommand}</strong>
            {selectedCommand ? (
              <button className="danger" type="button" onClick={() => onDeleteCommand(selectedCommand.id)}>
                {t.delete}
              </button>
            ) : null}
          </div>

          <label>
            <span>{t.name}</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.currentTarget.value }))}
            />
          </label>
          <label>
            <span>{t.commandCategory}</span>
            <select
              value={form.parentId ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, parentId: event.currentTarget.value || undefined }))}
            >
              <option value="">{t.commandUncategorized}</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>{t.note}</span>
            <input
              type="text"
              value={form.description ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.currentTarget.value }))}
            />
          </label>
          <label className="command-editor-textarea">
            <span>{t.commandTemplate}</span>
            <textarea
              rows={10}
              value={form.command}
              onChange={(event) => setForm((prev) => ({ ...prev, command: event.currentTarget.value }))}
            />
          </label>
          <div className="command-param-hints">
            <span>{t.commandParamHint}</span>
            {[1, 2, 3, 4, 5].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, command: `${prev.command}[p#${index}]` }))}
              >
                {`${t.commandParam}${index}`}
              </button>
            ))}
          </div>
          <label className="command-editor-checkbox">
            <input
              checked={form.appendCarriageReturn ?? true}
              type="checkbox"
              onChange={(event) => setForm((prev) => ({ ...prev, appendCarriageReturn: event.currentTarget.checked }))}
            />
            <span>{t.commandAppendCr}</span>
          </label>
          <div className="command-preview">
            <span>{t.commandDetectedParams}</span>
            <code>{extractCommandParams(form.command).join(', ') || '-'}</code>
          </div>
          <div className="command-manager-submit">
            <button type="button" onClick={handleSave}>{t.save}</button>
          </div>
        </section>
      </div>
    </div>
  )

  if (standalone) {
    return <div className="modal-shell standalone-shell">{shell}</div>
  }

  return <div className="modal-shell">{shell}</div>
}
