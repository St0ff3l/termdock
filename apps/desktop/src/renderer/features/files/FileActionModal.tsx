import { useEffect, useState } from 'react'
import { t } from '../../i18n'

export function FileActionModal({
  confirmLabel,
  danger,
  description,
  errorMessage,
  hint,
  initialValue = '',
  inputLabel,
  inputPlaceholder,
  onClose,
  onConfirm,
  title
}: {
  confirmLabel: string
  danger?: boolean
  description?: string
  errorMessage?: string | null
  hint?: string
  initialValue?: string
  inputLabel?: string
  inputPlaceholder?: string
  onClose(): void
  onConfirm(value: string): void
  title: string
}) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  return (
    <div className="modal-backdrop">
      <div className="modal-card file-action-modal">
        <div className="modal-header">
          <span>{title}</span>
          <button className="icon-button" onClick={onClose} type="button">×</button>
        </div>
        {description ? <div className="file-action-description">{description}</div> : null}
        {inputLabel ? (
          <label className="file-action-field">
            <span>{inputLabel}</span>
            <input
              autoFocus
              placeholder={inputPlaceholder}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  onConfirm(value)
                }
              }}
            />
          </label>
        ) : null}
        {hint ? <div className="file-action-hint">{hint}</div> : null}
        {errorMessage ? <div className="modal-error">{errorMessage}</div> : null}
        <div className="form-actions">
          <button className="flat-button" onClick={onClose} type="button">{t.cancel}</button>
          <button className={danger ? 'flat-button danger' : 'primary-button'} onClick={() => onConfirm(value)} type="button">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
