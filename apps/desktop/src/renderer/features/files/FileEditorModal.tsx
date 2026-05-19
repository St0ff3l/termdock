import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react'
import OpenCC from 'opencc-js'
import type { FileContentSnapshot } from '@termdock/core'
import { t } from '../../i18n'
import { EDITOR_ENCODINGS, findEncodingOption, sortEditorLanguages, type EditorLanguageOption } from './file-editor-config'

const toTraditional = OpenCC.Converter({ from: 'cn', to: 'tw' })
const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' })

type EditorInstance = Parameters<OnMount>[0]
type EditorMenu = 'file' | 'edit' | 'search' | 'preferences' | 'encoding' | 'language'

export function FileEditorModal({
  errorMessage,
  file,
  isBusy,
  onClose,
  onReloadWithEncoding,
  onSave,
  themeMode
}: {
  errorMessage: string | null
  file: FileContentSnapshot
  isBusy: boolean
  onClose(): void
  onReloadWithEncoding(encoding: string): void
  onSave(content: string, encoding: string): void
  themeMode: string
}) {
  const [content, setContent] = useState(file.content)
  const [encoding, setEncoding] = useState(file.encoding ?? 'utf-8')
  const [language, setLanguage] = useState('plaintext')
  const [wordWrap, setWordWrap] = useState(true)
  const [showMinimap, setShowMinimap] = useState(false)
  const [showLineNumbers, setShowLineNumbers] = useState(true)
  const [cursorLine, setCursorLine] = useState(1)
  const [cursorColumn, setCursorColumn] = useState(1)
  const [openMenu, setOpenMenu] = useState<EditorMenu | null>(null)
  const [languages, setLanguages] = useState<EditorLanguageOption[]>([{ id: 'plaintext', label: 'Plain Text' }])

  const editorRef = useRef<EditorInstance | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const encodingRef = useRef(encoding)
  const shellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    setContent(file.content)
    setEncoding(file.encoding ?? 'utf-8')
  }, [file.content, file.encoding, file.path])

  useEffect(() => {
    encodingRef.current = encoding
  }, [encoding])

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!shellRef.current?.contains(event.target as Node)) {
        setOpenMenu(null)
      }
    }

    window.addEventListener('pointerdown', onPointerDown)
    return () => window.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const isDirty = content !== file.content || encoding !== (file.encoding ?? 'utf-8')
  const lineCount = useMemo(() => (content.match(/\n/g)?.length ?? 0) + 1, [content])
  const characterCount = content.length
  const currentEncoding = findEncodingOption(encoding)
  const currentLanguage = languages.find((option) => option.id === language)?.label ?? language

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    setLanguages(sortEditorLanguages(monaco.languages.getLanguages()))

    monaco.editor.defineTheme('termdock-default-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#111316',
        'editor.foreground': '#d6dde7',
        'editorLineNumber.foreground': '#5f6875',
        'editorLineNumber.activeForeground': '#9faab8',
        'editorCursor.foreground': '#7cc7ff',
        'editor.selectionBackground': '#21466b',
        'editor.inactiveSelectionBackground': '#1a354d',
        'editor.lineHighlightBackground': '#161b22',
        'editorIndentGuide.background1': '#1f2630',
        'editorIndentGuide.activeBackground1': '#344150'
      }
    })

    monaco.editor.setTheme(themeMode === 'default-dark' ? 'termdock-default-dark' : 'vs')
    setLanguage(editor.getModel()?.getLanguageId() ?? 'plaintext')

    const position = editor.getPosition()
    if (position) {
      setCursorLine(position.lineNumber)
      setCursorColumn(position.column)
    }

    editor.onDidChangeCursorPosition((event) => {
      setCursorLine(event.position.lineNumber)
      setCursorColumn(event.position.column)
    })

    editor.onDidChangeModelLanguage(() => {
      setLanguage(editor.getModel()?.getLanguageId() ?? 'plaintext')
    })

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSave(editor.getValue(), encodingRef.current)
    })
  }

  useEffect(() => {
    if (!monacoRef.current) {
      return
    }
    monacoRef.current.editor.setTheme(themeMode === 'default-dark' ? 'termdock-default-dark' : 'vs')
  }, [themeMode])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) {
      return
    }
    editor.updateOptions({
      lineNumbers: showLineNumbers ? 'on' : 'off',
      minimap: { enabled: showMinimap },
      wordWrap: wordWrap ? 'on' : 'off'
    })
  }, [showLineNumbers, showMinimap, wordWrap])

  const runEditorAction = async (actionId: string) => {
    const editor = editorRef.current
    if (!editor) {
      return
    }
    await editor.getAction(actionId)?.run()
    setOpenMenu(null)
  }

  const updateLanguage = (nextLanguage: string) => {
    const editor = editorRef.current
    const model = editor?.getModel()
    if (model && editor) {
      monacoRef.current?.editor.setModelLanguage(model, nextLanguage)
    }
    setLanguage(nextLanguage)
    setOpenMenu(null)
  }

  const convertContent = (converter: (text: string) => string) => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const model = editor.getModel()
    const selection = editor.getSelection()
    const selectedText = selection ? model?.getValueInRange(selection) ?? '' : ''

    if (selection && !selection.isEmpty() && selectedText) {
      editor.executeEdits('opencc-convert', [{ range: selection, text: converter(selectedText) }])
    } else {
      const current = editor.getValue()
      editor.setValue(converter(current))
    }

    setContent(editor.getValue())
    setOpenMenu(null)
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-card file-editor-modal file-editor-modal--dark" ref={shellRef}>
        <div className="modal-header">
          <div className="file-editor-title">
            <span>{file.source === 'remote' ? t.editRemoteFile : t.editLocalFile}</span>
            <strong>{file.name}</strong>
            {isDirty ? <b>{t.fileEditorUnsaved}</b> : null}
          </div>
          <div className="file-editor-header-actions">
            <button className="flat-button compact" disabled={!isDirty || isBusy} onClick={() => onSave(content, encoding)} type="button">
              {t.save}
            </button>
            <button className="icon-button" onClick={onClose} type="button">×</button>
          </div>
        </div>

        <div className="file-editor-menubar">
          <EditorMenuButton current={openMenu} label={t.fileEditorFile} menu="file" onToggle={setOpenMenu}>
            <MenuAction label={t.save} onClick={() => onSave(content, encoding)} />
            <MenuAction label={t.fileEditorReloadEncoding} onClick={() => setOpenMenu('encoding')} />
          </EditorMenuButton>
          <EditorMenuButton current={openMenu} label={t.edit} menu="edit" onToggle={setOpenMenu}>
            <MenuAction label={t.fileEditorUndo} onClick={() => void runEditorAction('undo')} />
            <MenuAction label={t.fileEditorRedo} onClick={() => void runEditorAction('redo')} />
            <MenuSeparator />
            <MenuAction label={t.fileEditorSelectAll} onClick={() => void runEditorAction('editor.action.selectAll')} />
            <MenuSeparator />
            <MenuAction label={t.fileEditorToTraditional} onClick={() => convertContent(toTraditional)} />
            <MenuAction label={t.fileEditorToSimplified} onClick={() => convertContent(toSimplified)} />
          </EditorMenuButton>
          <EditorMenuButton current={openMenu} label={t.fileEditorSearch} menu="search" onToggle={setOpenMenu}>
            <MenuAction label={t.fileEditorFind} onClick={() => void runEditorAction('actions.find')} />
            <MenuAction label={t.fileEditorReplace} onClick={() => void runEditorAction('editor.action.startFindReplaceAction')} />
            <MenuAction label={t.fileEditorGoToLine} onClick={() => void runEditorAction('editor.action.gotoLine')} />
          </EditorMenuButton>
          <EditorMenuButton current={openMenu} label={t.fileEditorPreferences} menu="preferences" onToggle={setOpenMenu}>
            <MenuToggle label={t.fileEditorWordWrap} checked={wordWrap} onClick={() => setWordWrap((value) => !value)} />
            <MenuToggle label={t.fileEditorShowLineNumbers} checked={showLineNumbers} onClick={() => setShowLineNumbers((value) => !value)} />
            <MenuToggle label={t.fileEditorShowMinimap} checked={showMinimap} onClick={() => setShowMinimap((value) => !value)} />
          </EditorMenuButton>
        </div>

        <div className="file-editor-path" title={file.path}>{file.path}</div>

        <div className="file-editor-body">
          <Editor
            height="100%"
            onChange={(value) => setContent(value ?? '')}
            onMount={handleMount}
            options={{
              automaticLayout: true,
              fontFamily: '"SF Mono", Menlo, Consolas, monospace',
              fontLigatures: true,
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: showMinimap },
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'line',
              roundedSelection: true,
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              wordWrap: wordWrap ? 'on' : 'off',
              lineNumbers: showLineNumbers ? 'on' : 'off'
            }}
            path={file.path}
            theme={themeMode === 'default-dark' ? 'termdock-default-dark' : 'vs'}
            value={content}
          />
        </div>

        {errorMessage ? <div className="modal-error">{errorMessage}</div> : null}

        <div className="file-editor-statusbar">
          <span>{t.fileEditorStatusReady}</span>
          <span>{t.fileEditorLines}: {lineCount}</span>
          <span>{t.fileEditorCharacters}: {characterCount}</span>
          <span>{t.fileEditorCursor}: {cursorLine}:{cursorColumn}</span>
          <div className="file-editor-status-actions">
            <div className="file-editor-status-menu">
              <button className="file-editor-status-button" onClick={() => setOpenMenu((current) => current === 'encoding' ? null : 'encoding')} type="button">
                {currentEncoding.label}
              </button>
              {openMenu === 'encoding' ? (
                <div className="file-editor-menu file-editor-menu--wide">
                  {EDITOR_ENCODINGS.map((option) => (
                    <button
                      className={option.value === encoding ? 'is-active' : ''}
                      key={option.value}
                      onClick={() => {
                        setEncoding(option.value)
                        onReloadWithEncoding(option.value)
                        setOpenMenu(null)
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="file-editor-status-menu">
              <button className="file-editor-status-button" onClick={() => setOpenMenu((current) => current === 'language' ? null : 'language')} type="button">
                {currentLanguage}
              </button>
              {openMenu === 'language' ? (
                <div className="file-editor-menu file-editor-menu--wide">
                  {languages.map((option) => (
                    <button
                      className={option.id === language ? 'is-active' : ''}
                      key={option.id}
                      onClick={() => updateLanguage(option.id)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function EditorMenuButton({
  children,
  current,
  label,
  menu,
  onToggle
}: {
  children: ReactNode
  current: EditorMenu | null
  label: string
  menu: 'file' | 'edit' | 'search' | 'preferences'
  onToggle(menu: EditorMenu | null): void
}) {
  const open = current === menu

  return (
    <div className="file-editor-menu-anchor">
      <button className={`file-editor-menubar-button ${open ? 'is-open' : ''}`} onClick={() => onToggle(open ? null : menu)} type="button">
        {label}
      </button>
      {open ? <div className="file-editor-menu">{children}</div> : null}
    </div>
  )
}

function MenuAction({ label, onClick }: { label: string; onClick(): void }) {
  return <button onClick={onClick} type="button">{label}</button>
}

function MenuToggle({ checked, label, onClick }: { checked: boolean; label: string; onClick(): void }) {
  return (
    <button onClick={onClick} type="button">
      <span>{checked ? '✓ ' : ''}</span>
      {label}
    </button>
  )
}

function MenuSeparator() {
  return <div className="file-editor-menu-separator" />
}
