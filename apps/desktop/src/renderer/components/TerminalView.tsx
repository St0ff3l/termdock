import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { copyText } from '../app/app-utils'
import { t } from '../i18n'
import { ContextMenu } from '../features/common/ContextMenu'

const TERMINAL_BOTTOM_GAP_ROWS = 2

function localizeTerminalText(value: string) {
  return value
    .replaceAll('连接主机成功', t.terminalConnected)
    .replaceAll('连接主机...', t.terminalConnecting)
    .replaceAll('连接已断开', t.terminalDisconnected)
    .replaceAll('[connection closed]', t.terminalConnectionClosed)
    .replaceAll('Shell closed', t.terminalDisconnected)
    .replace(/连接失败:\s*/g, t.connectionFailedPrefix)
    .replace(/Connection error:\s*/g, t.connectionFailedPrefix)
    .replace(/Disconnected from\s*/g, t.disconnectedFromPrefix)
    .replace(/\bDisconnected\b/g, t.disconnected)
}

export function TerminalView({
  tabId,
  initialText,
  onStatus
}: {
  tabId: string
  initialText: string
  onStatus?(message: string | null): void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const renderedTranscriptRef = useRef(initialText)
  const findInputRef = useRef<HTMLInputElement | null>(null)
  const initialTextRef = useRef(initialText)
  const bootedTabs = useRef(new Set<string>())
  const wasConnectedRef = useRef(false)
  const [hasSelection, setHasSelection] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findMiss, setFindMiss] = useState(false)
  const [findMatchCount, setFindMatchCount] = useState(0)
  const [activeFindIndex, setActiveFindIndex] = useState(-1)
  const isMac = window.termdock?.platform === 'darwin'

  const shortcuts = {
    copy: isMac ? '⌘C' : 'Ctrl+Shift+C',
    paste: isMac ? '⌘V' : 'Ctrl+Shift+V',
    find: isMac ? '⌘F' : 'Ctrl+F'
  }

  const readColor = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

  const buildTerminalTheme = (highlightFind: boolean) => ({
    background: readColor('--terminal-bg', '#1e1e1e'),
    foreground: readColor('--terminal-text', '#e0e0e0'),
    cursor: readColor('--terminal-text', '#e0e0e0'),
    green: readColor('--success', '#39d98a'),
    brightGreen: readColor('--success', '#52f2a0'),
    blue: readColor('--accent-text', '#c8d0da'),
    brightBlue: readColor('--text-main', '#f1f5f9'),
    selectionBackground: readColor(
      highlightFind ? '--terminal-search-highlight' : '--terminal-cmd-bg',
      highlightFind ? 'rgba(236, 255, 71, 0.82)' : 'rgba(148, 163, 184, 0.24)'
    )
  })

  const applyTerminalTheme = () => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    terminal.options.theme = buildTerminalTheme(findOpen && Boolean(findQuery))
    terminal.refresh(0, Math.max(terminal.rows - 1, 0))
  }

  const clearFindSelection = () => {
    const terminal = terminalRef.current
    if (terminal?.hasSelection()) {
      terminal.clearSelection()
    }
  }

  const closeFind = () => {
    setFindOpen(false)
    setFindQuery('')
    setFindMiss(false)
    setFindMatchCount(0)
    setActiveFindIndex(-1)
    clearFindSelection()
    terminalRef.current?.focus()
  }

  const collectFindMatches = (query: string) => {
    const terminal = terminalRef.current
    if (!terminal || !query) {
      return []
    }

    const normalizedQuery = query.toLocaleLowerCase()
    const buffer = terminal.buffer.active
    const matches: Array<{ row: number; column: number }> = []

    for (let row = 0; row < buffer.length; row += 1) {
      const line = buffer.getLine(row)?.translateToString(true) ?? ''
      const haystack = line.toLocaleLowerCase()
      let searchFrom = 0

      while (searchFrom <= haystack.length - normalizedQuery.length) {
        const column = haystack.indexOf(normalizedQuery, searchFrom)
        if (column === -1) {
          break
        }
        matches.push({ row, column })
        searchFrom = column + Math.max(1, normalizedQuery.length)
      }
    }

    return matches
  }

  const selectFindMatch = (query: string, index: number, matches = collectFindMatches(query)) => {
    const terminal = terminalRef.current
    if (!terminal || !query) {
      setFindMiss(false)
      setFindMatchCount(0)
      setActiveFindIndex(-1)
      clearFindSelection()
      return false
    }

    setFindMatchCount(matches.length)

    if (matches.length === 0) {
      setFindMiss(true)
      setActiveFindIndex(-1)
      clearFindSelection()
      terminal.focus()
      return false
    }

    const normalizedIndex = ((index % matches.length) + matches.length) % matches.length
    const match = matches[normalizedIndex]

    terminal.scrollToLine(match.row)
    terminal.select(match.column, match.row, query.length)
    setFindMiss(false)
    setActiveFindIndex(normalizedIndex)
    terminal.focus()
    return true
  }

  const runCopy = () => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    const selection = terminal.getSelection()
    if (!selection) {
      return
    }
    copyText(selection)
    terminal.focus()
  }

  const runPaste = async () => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    const value = await navigator.clipboard?.readText?.()
    if (value) {
      terminal.paste(value)
    }
    terminal.focus()
  }

  const searchTerminal = (query: string, direction: 1 | -1 = 1) => {
    if (!query) {
      setFindMiss(false)
      setFindMatchCount(0)
      setActiveFindIndex(-1)
      clearFindSelection()
      return false
    }

    const matches = collectFindMatches(query)
    if (matches.length === 0) {
      setFindMiss(true)
      setFindMatchCount(0)
      setActiveFindIndex(-1)
      clearFindSelection()
      terminalRef.current?.focus()
      return false
    }

    const nextIndex = activeFindIndex >= 0 ? activeFindIndex + direction : direction === -1 ? matches.length - 1 : 0
    return selectFindMatch(query, nextIndex, matches)
  }

  const openFind = () => {
    setContextMenu(null)
    setFindOpen(true)
    setFindMiss(false)
  }

  const runFind = () => {
    openFind()
  }

  const runClear = () => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    terminal.clear()
    terminal.focus()
  }

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const terminal = new Terminal({
      fontFamily: '"SF Mono", Menlo, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.45,
      cursorBlink: true,
      allowTransparency: true,
      theme: buildTerminalTheme(false)
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(hostRef.current)
    terminalRef.current = terminal

    const fitTerminal = () => {
      const dimensions = fitAddon.proposeDimensions()

      if (!dimensions) {
        return
      }

      terminal.resize(dimensions.cols, Math.max(1, dimensions.rows - TERMINAL_BOTTOM_GAP_ROWS))
    }

    fitTerminal()

    if (initialTextRef.current) {
      terminal.write(localizeTerminalText(initialTextRef.current))
    }
    renderedTranscriptRef.current = localizeTerminalText(initialTextRef.current)

    const resize = () => {
      fitTerminal()
      void window.termdock?.resizeTerminal(tabId, terminal.cols, terminal.rows)
    }

    const onDataDispose = terminal.onData((data) => {
      if (terminal.hasSelection()) {
        terminal.clearSelection()
      }
      setContextMenu(null)
      void window.termdock?.writeTerminal(tabId, data)
    })

    const onResizeDispose = terminal.onResize(({ cols, rows }) => {
      void window.termdock?.resizeTerminal(tabId, cols, rows)
    })

    const onSelectionDispose = terminal.onSelectionChange(() => {
      setHasSelection(terminal.hasSelection())
    })

    const offData = window.termdock?.onTerminalData(({ tabId: nextTabId, chunk }) => {
      if (nextTabId === tabId) {
        const localizedChunk = localizeTerminalText(chunk)
        terminal.write(localizedChunk)
        renderedTranscriptRef.current += localizedChunk
      }
    })

    const offState = window.termdock?.onTerminalState(({ tabId: nextTabId, summary, connected }) => {
      if (nextTabId === tabId) {
        onStatus?.(localizeTerminalText(summary))
        if (wasConnectedRef.current && !connected) {
          terminal.writeln(`\r\n${t.terminalConnectionClosed}`)
          renderedTranscriptRef.current += `\r\n${t.terminalConnectionClosed}`
        }
        wasConnectedRef.current = connected
      }
    })

    const resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(hostRef.current)

    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault()
      setHasSelection(terminal.hasSelection())
      setContextMenu({ x: event.clientX, y: event.clientY })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (document.activeElement !== terminal.textarea) {
        return
      }

      const matchesCopy = isMac
        ? event.metaKey && !event.shiftKey && event.key.toLowerCase() === 'c'
        : event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'c'
      const matchesPaste = isMac
        ? event.metaKey && !event.shiftKey && event.key.toLowerCase() === 'v'
        : event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'v'
      const matchesFind = isMac
        ? event.metaKey && !event.shiftKey && event.key.toLowerCase() === 'f'
        : event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'f'

      if (matchesCopy) {
        event.preventDefault()
        runCopy()
        return
      }

      if (matchesPaste) {
        event.preventDefault()
        void runPaste()
        return
      }

      if (matchesFind) {
        event.preventDefault()
        openFind()
        return
      }

      if (!isMac && event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        runClear()
      }
    }

    hostRef.current.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)

    // Ask the main process for the actual PTY size once the terminal is mounted.
    if (!bootedTabs.current.has(tabId)) {
      bootedTabs.current.add(tabId)
      resize()
    }

    return () => {
      onDataDispose.dispose()
      onResizeDispose.dispose()
      onSelectionDispose.dispose()
      offData?.()
      offState?.()
      resizeObserver.disconnect()
      hostRef.current?.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      terminalRef.current = null
      terminal.dispose()
    }
  }, [isMac, onStatus, tabId])

  useEffect(() => {
    if (!terminalRef.current) {
      return
    }

    applyTerminalTheme()
  }, [findOpen, findQuery])

  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => {
      applyTerminalTheme()
    })

    observer.observe(root, {
      attributes: true,
      attributeFilter: ['data-theme', 'style', 'class']
    })

    return () => observer.disconnect()
  }, [findOpen, findQuery])

  useEffect(() => {
    const terminal = terminalRef.current
    if (!terminal) {
      initialTextRef.current = initialText
      renderedTranscriptRef.current = initialText
      return
    }

    const localizedInitialText = localizeTerminalText(initialText)

    if (localizedInitialText === renderedTranscriptRef.current) {
      return
    }

    terminal.reset()
    if (localizedInitialText) {
      terminal.write(localizedInitialText)
    }
    renderedTranscriptRef.current = localizedInitialText
    setHasSelection(false)
    setContextMenu(null)
    if (findQuery) {
      const matches = collectFindMatches(findQuery)
      setFindMatchCount(matches.length)
      if (matches.length === 0) {
        setFindMiss(true)
        setActiveFindIndex(-1)
      } else {
        void selectFindMatch(findQuery, activeFindIndex >= 0 ? Math.min(activeFindIndex, matches.length - 1) : 0, matches)
      }
    }
  }, [initialText])

  useEffect(() => {
    if (!findOpen) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      findInputRef.current?.focus()
      findInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [findOpen])

  useEffect(() => {
    if (!findOpen) {
      return
    }

    if (!findQuery) {
      setFindMiss(false)
      setFindMatchCount(0)
      setActiveFindIndex(-1)
      clearFindSelection()
      return
    }

    const matches = collectFindMatches(findQuery)
    setFindMatchCount(matches.length)

    if (matches.length === 0) {
      setFindMiss(true)
      setActiveFindIndex(-1)
      clearFindSelection()
      return
    }

    setFindMiss(false)
    if (activeFindIndex === -1) {
      void selectFindMatch(findQuery, 0, matches)
      return
    }
    if (activeFindIndex >= matches.length) {
      setActiveFindIndex(matches.length - 1)
    }
  }, [activeFindIndex, findOpen, findQuery])

  return (
    <>
      <div className="terminal-host" ref={hostRef} />
      {findOpen ? (
        <div className="terminal-find" onClick={(event) => event.stopPropagation()}>
          <input
            ref={findInputRef}
            type="text"
            value={findQuery}
            onChange={(event) => {
              setFindQuery(event.target.value)
              setFindMiss(false)
              setActiveFindIndex(-1)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                searchTerminal(findQuery, event.shiftKey ? -1 : 1)
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                closeFind()
              }
            }}
            placeholder={t.find}
          />
          <div className="terminal-find-count" aria-live="polite">
            {findQuery && findMatchCount > 0 ? `${Math.max(activeFindIndex + 1, 1)}/${findMatchCount}` : null}
          </div>
          <button type="button" title={t.findPrevious} onClick={() => searchTerminal(findQuery, -1)}>↑</button>
          <button type="button" title={t.findNext} onClick={() => searchTerminal(findQuery, 1)}>↓</button>
          <button type="button" onClick={() => searchTerminal(findQuery, 1)}>{t.find}</button>
          <button type="button" onClick={closeFind}>×</button>
          {findMiss ? <span className="terminal-find-status">{t.findNotFound}</span> : null}
        </div>
      ) : null}
      {contextMenu ? (
        <ContextMenu
          className="terminal-context-menu"
          items={[
            { label: t.copy, shortcut: shortcuts.copy, disabled: !hasSelection, action: runCopy },
            { label: t.paste, shortcut: shortcuts.paste, action: () => void runPaste() },
            { separator: true },
            { label: t.find, shortcut: shortcuts.find, action: runFind },
            { label: t.clearScreen, action: runClear }
          ]}
          onClose={() => setContextMenu(null)}
          position={contextMenu}
        />
      ) : null}
    </>
  )
}
