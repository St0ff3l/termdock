import { useEffect, useState } from 'react'
import { t } from '../../i18n'

export function RootAccessModal({
  defaultSshUser,
  defaultSudoUser,
  errorMessage,
  onClose,
  onSubmit
}: {
  defaultSshUser?: string
  defaultSudoUser?: string
  errorMessage?: string | null
  onClose(): void
  onSubmit(input: { sudoUser: string; sudoPassword: string }): void
}) {
  const [sudoUser, setSudoUser] = useState(defaultSudoUser || 'root')
  const [sudoPassword, setSudoPassword] = useState('')

  useEffect(() => {
    setSudoUser(defaultSudoUser || 'root')
    setSudoPassword('')
  }, [defaultSudoUser])

  return (
    <div className="modal-backdrop">
      <div className="modal-card root-access-modal">
        <div className="modal-header">
          <span>{t.fileRootAccessTitle}</span>
          <button className="icon-button" onClick={onClose} type="button">×</button>
        </div>

        <div className="root-access-description">{t.fileRootAccessDescription}</div>

        <div className="root-access-meta">
          <span>{t.fileRootAccessLoginUser}</span>
          <strong>{defaultSshUser || '-'}</strong>
        </div>

        <label className="file-action-field">
          <span>{t.fileRootAccessTargetUser}</span>
          <input
            autoFocus
            value={sudoUser}
            onChange={(event) => setSudoUser(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onSubmit({ sudoUser, sudoPassword })
              }
            }}
          />
        </label>

        <label className="file-action-field">
          <span>{t.fileRootAccessPassword}</span>
          <input
            type="password"
            value={sudoPassword}
            onChange={(event) => setSudoPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onSubmit({ sudoUser, sudoPassword })
              }
            }}
          />
        </label>

        <div className="file-action-hint">{t.fileRootAccessPasswordHint}</div>
        {errorMessage ? <div className="modal-error">{errorMessage}</div> : null}

        <div className="form-actions">
          <button className="flat-button" onClick={onClose} type="button">{t.cancel}</button>
          <button
            className="primary-button"
            onClick={() => onSubmit({ sudoUser, sudoPassword })}
            type="button"
          >
            {t.fileRootAccessConfirm}
          </button>
        </div>
      </div>
    </div>
  )
}
