import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { CommandFolder, CommandTemplate, CommandTemplateInput } from '@termdock/core'
import { t } from '../../i18n'
import { extractCommandParams, sortByOrder } from './command-utils'

export const emptyCommandForm: CommandTemplateInput = {
  name: '',
  command: '',
  description: '',
  parentId: undefined,
  appendCarriageReturn: true
}

export function toCommandTemplateInput(command: CommandTemplate): CommandTemplateInput {
  return {
    name: command.name,
    command: command.command,
    description: command.description ?? '',
    parentId: command.parentId,
    order: command.order,
    appendCarriageReturn: command.appendCarriageReturn
  }
}

function CommandDialogShell({
  title,
  standalone = false,
  onClose,
  children
}: {
  title: string
  standalone?: boolean
  onClose(): void
  children: ReactNode
}) {
  const dialog = (
    <div className={`modal-card command-dialog command-editor-page ${standalone ? 'standalone' : ''}`} onClick={(event) => event.stopPropagation()}>
      <div className="modal-header">
        <span>{title}</span>
        {!standalone ? <button className="icon-button" onClick={onClose} type="button">×</button> : null}
      </div>
      <div className="command-dialog-body">
        {children}
      </div>
    </div>
  )

  if (standalone) {
    return <div className="command-editor-window">{dialog}</div>
  }

  return (
    <div className="modal-backdrop command-dialog-backdrop" onClick={onClose}>
      {dialog}
    </div>
  )
}

export function CommandEditorModal({
  folders,
  initialValue,
  mode,
  standalone = false,
  onClose,
  onSubmit
}: {
  folders: CommandFolder[]
  initialValue: CommandTemplateInput
  mode: 'create' | 'edit'
  standalone?: boolean
  onClose(): void
  onSubmit(input: CommandTemplateInput): void
}) {
  const [form, setForm] = useState<CommandTemplateInput>(initialValue)
  const orderedFolders = useMemo(() => sortByOrder(folders), [folders])
  const title = mode === 'edit' && initialValue.name ? `${t.commandEdit}-${initialValue.name}` : t.commandCreate

  useEffect(() => {
    setForm(initialValue)
  }, [
    mode,
    initialValue.name,
    initialValue.command,
    initialValue.description,
    initialValue.parentId,
    initialValue.order,
    initialValue.appendCarriageReturn
  ])

  return (
    <CommandDialogShell title={title} standalone={standalone} onClose={onClose}>
      <div className="command-editor-dialog-form">
        <div className="command-editor-grid">
          <label className="command-editor-field full">
            <span>{t.name}</span>
            <input
              type="text"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.currentTarget.value }))}
            />
          </label>
          <label className="command-editor-field">
            <span>{t.commandCategory}</span>
            <select
              value={form.parentId ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, parentId: event.currentTarget.value || undefined }))}
            >
              <option value="">{t.commandUncategorized}</option>
              {orderedFolders.map((folder) => (
                <option key={folder.id} value={folder.id}>{folder.name}</option>
              ))}
            </select>
          </label>
          <label className="command-editor-field">
            <span>{t.note}</span>
            <input
              type="text"
              value={form.description ?? ''}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.currentTarget.value }))}
            />
          </label>
          <label className="command-editor-field full command-editor-dialog-textarea">
            <span>{t.commandTemplate}</span>
            <textarea
              rows={12}
              value={form.command}
              onChange={(event) => setForm((prev) => ({ ...prev, command: event.currentTarget.value }))}
            />
          </label>
          <div className="command-editor-field full command-editor-dialog-params">
            <span>{t.commandParamHint}</span>
            <div className="command-param-hints">
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
            <small>{t.commandParamExplain}</small>
          </div>
          <label className="command-editor-field full command-editor-checkbox-row">
            <input
              checked={form.appendCarriageReturn ?? true}
              type="checkbox"
              onChange={(event) => setForm((prev) => ({ ...prev, appendCarriageReturn: event.currentTarget.checked }))}
            />
            <span>{t.commandAppendCr}</span>
          </label>
          <div className="command-editor-field full command-preview">
            <span>{t.commandDetectedParams}</span>
            <code>{extractCommandParams(form.command).join(', ') || '-'}</code>
          </div>
        </div>
        <div className="form-actions command-dialog-actions">
          <button className="flat-button" type="button" onClick={onClose}>{t.cancel}</button>
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              if (!form.name?.trim() || !form.command?.trim()) {
                return
              }
              onSubmit({
                ...form,
                name: form.name.trim(),
                command: form.command.trim(),
                description: form.description?.trim() || undefined
              })
            }}
          >
            {t.save}
          </button>
        </div>
      </div>
    </CommandDialogShell>
  )
}
