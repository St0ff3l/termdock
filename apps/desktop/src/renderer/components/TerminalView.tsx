import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { WebglAddon } from '@xterm/addon-webgl'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { copyText } from '../app/app-utils'
import { t } from '../i18n'
import { ContextMenu } from '../features/common/ContextMenu'

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

function toDisplayTerminalText(value: string) {
  // Localize fixed TermDock notices before preserving terminal control semantics later.
  return localizeTerminalText(value)
}

function splitOscPayload(payload: string) {
  const separatorIndex = payload.indexOf(';')
  if (separatorIndex === -1) {
    return null
  }

  return {
    target: payload.slice(0, separatorIndex),
    data: payload.slice(separatorIndex + 1)
  }
}

function isOsc52TargetSupported(target: string) {
  return target === ''
    || /[cpsq01234567]/.test(target)
}

function decodeBase64Utf8(value: string) {
  try {
    const normalized = value.replace(/\s+/g, '')
    const bytes = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

function encodeBase64Utf8(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function isWideCodePoint(codePoint: number) {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f)
    || (codePoint >= 0x2329 && codePoint <= 0x232a)
    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
    || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
    || (codePoint >= 0xff00 && codePoint <= 0xff60)
    || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
    || (codePoint >= 0x1f300 && codePoint <= 0x1faf6)
    || (codePoint >= 0x20000 && codePoint <= 0x3fffd)
  )
}

function getTerminalCellWidth(value: string) {
  const stripped = value.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
  return Array.from(stripped).reduce((width, char) => {
    const codePoint = char.codePointAt(0) ?? 0
    return width + (isWideCodePoint(codePoint) ? 2 : 1)
  }, 0)
}

function rowsForDisplayWidth(width: number, cols: number) {
  return Math.max(1, Math.ceil(Math.max(0, width) / Math.max(1, cols)))
}

const TERMINAL_TRANSCRIPT_LIMIT = 200_000
const TERMINAL_FIT_GUARD_ROWS = 1
const TERMINAL_RESIZE_DEBOUNCE_MS = 140
const TERMINAL_SEARCH_DECORATIONS = {
  matchBackground: '#4b5563',
  matchOverviewRuler: '#9ca3af',
  activeMatchBackground: '#f3f4f6',
  activeMatchColorOverviewRuler: '#f3f4f6'
}

function trimTranscript(transcript: string) {
  if (transcript.length <= TERMINAL_TRANSCRIPT_LIMIT) {
    return transcript
  }

  return transcript.slice(transcript.length - TERMINAL_TRANSCRIPT_LIMIT)
}

function loadAcceleratedRenderer(terminal: Terminal) {
  const disposables: Array<{ dispose(): void }> = []

  try {
    const webglAddon = new WebglAddon()
    terminal.loadAddon(webglAddon)
    disposables.push(webglAddon)
    const contextLossDisposable = webglAddon.onContextLoss(() => {
      contextLossDisposable.dispose()
      webglAddon.dispose()
      console.warn('xterm WebGL renderer context was lost. Falling back to the default renderer.')
    })
    disposables.push(contextLossDisposable)
  } catch (error) {
    console.warn('Failed to initialize xterm WebGL renderer. Falling back to the default renderer.', error)
  }

  return {
    dispose: () => {
      for (let index = disposables.length - 1; index >= 0; index -= 1) {
        disposables[index].dispose()
      }
    }
  }
}

export function TerminalView({
  tabId,
  bootText,
  onStatus
}: {
  tabId: string
  bootText: string
  onStatus?(message: string | null): void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const searchAddonRef = useRef<SearchAddon | null>(null)
  const findInputRef = useRef<HTMLInputElement | null>(null)
  const bootTextRef = useRef(bootText)
  const renderedTranscriptRef = useRef('')
  const pendingWriteRef = useRef('')
  const writeFrameRef = useRef<number | null>(null)
  const resizeTimerRef = useRef<number | null>(null)
  const pendingResizeForceRef = useRef(false)
  const isWritingRef = useRef(false)
  const activeInlineRedrawRef = useRef(false)
  const inlineRedrawContentRef = useRef('')
  const inlineRedrawRowsRef = useRef(1)
  const suppressHydratedChunksUntilRef = useRef(0)
  const preserveVisibleBufferRef = useRef(false)
  const bootedTabs = useRef(new Set<string>())
  const wasConnectedRef = useRef(false)
  const lastSyncedSizeRef = useRef<{ cols: number; rows: number; width: number; height: number } | null>(null)
  const [hasSelection, setHasSelection] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findMiss, setFindMiss] = useState(false)
  const [findMatchCount, setFindMatchCount] = useState(0)
  const [activeFindIndex, setActiveFindIndex] = useState(-1)
  const [findCaseSensitive, setFindCaseSensitive] = useState(false)
  const [findRegex, setFindRegex] = useState(false)
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
      highlightFind ? '#f3f4f6' : 'rgba(148, 163, 184, 0.24)'
    ),
    selectionForeground: highlightFind ? '#111827' : undefined
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
    searchAddonRef.current?.clearDecorations()
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

  const buildSearchOptions = (incremental = false) => ({
    caseSensitive: findCaseSensitive,
    regex: findRegex,
    incremental,
    decorations: TERMINAL_SEARCH_DECORATIONS
  })

  const runCopy = () => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    const selection = terminal.getSelection()
    if (!selection) {
      return
    }
    if (window.termdock?.writeClipboardText) {
      void window.termdock.writeClipboardText(selection)
    } else {
      copyText(selection)
    }
    terminal.focus()
  }

  const runPaste = async () => {
    const terminal = terminalRef.current
    if (!terminal) {
      return
    }
    const value = window.termdock?.readClipboardText
      ? await window.termdock.readClipboardText()
      : await navigator.clipboard?.readText?.()
    if (value) {
      terminal.paste(value)
    }
    terminal.focus()
  }

  const searchTerminal = (query: string, direction: 1 | -1 = 1) => {
    const searchAddon = searchAddonRef.current
    if (!query) {
      setFindMiss(false)
      setFindMatchCount(0)
      setActiveFindIndex(-1)
      clearFindSelection()
      return false
    }

    if (!searchAddon) {
      setFindMiss(true)
      setFindMatchCount(0)
      setActiveFindIndex(-1)
      clearFindSelection()
      return false
    }

    try {
      const found = direction === -1
        ? searchAddon.findPrevious(query, buildSearchOptions())
        : searchAddon.findNext(query, buildSearchOptions())

      if (!found) {
        setFindMiss(true)
        setFindMatchCount(0)
        setActiveFindIndex(-1)
        clearFindSelection()
      }

      return found
    } catch {
      setFindMiss(true)
      setFindMatchCount(0)
      setActiveFindIndex(-1)
      clearFindSelection()
      return false
    }
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

  const flushPendingWrite = () => {
    writeFrameRef.current = null
    const terminal = terminalRef.current
    if (!terminal) {
      pendingWriteRef.current = ''
      return
    }

    if (!pendingWriteRef.current) {
      return
    }

    if (isWritingRef.current) {
      writeFrameRef.current = window.requestAnimationFrame(flushPendingWrite)
      return
    }

    const nextChunk = pendingWriteRef.current
    pendingWriteRef.current = ''
    isWritingRef.current = true
    terminal.write(nextChunk, () => {
      isWritingRef.current = false
      if (pendingWriteRef.current && writeFrameRef.current === null) {
        writeFrameRef.current = window.requestAnimationFrame(flushPendingWrite)
      }
    })
  }

  const scheduleTerminalWrite = (text: string) => {
    if (!text) {
      return
    }

    pendingWriteRef.current += text
    if (writeFrameRef.current === null) {
      writeFrameRef.current = window.requestAnimationFrame(flushPendingWrite)
    }
  }

  const clearInlineRedrawState = () => {
    activeInlineRedrawRef.current = false
    inlineRedrawContentRef.current = ''
    inlineRedrawRowsRef.current = 1
  }

  const buildExitAlternateScreenSequence = () =>
    '\x1b[?1049l\x1b[?1047l\x1b[?47l\x1b[?25h'

  const snapshotTerminalBuffer = (terminal: Terminal) => {
    const lines: string[] = []
    const buffer = terminal.buffer.active

    for (let row = 0; row < buffer.length; row += 1) {
      lines.push(buffer.getLine(row)?.translateToString(true) ?? '')
    }

    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop()
    }

    return lines.join('\r\n')
  }

  const appendRenderedTranscript = (chunk: string) => {
    if (!chunk) {
      return
    }

    renderedTranscriptRef.current = trimTranscript(`${renderedTranscriptRef.current}${chunk}`)
  }

  const formatTerminalChunk = (terminal: Terminal | null, value: string) => {
    const displayText = toDisplayTerminalText(value)
    return terminal ? normalizeInlineRedrawChunk(terminal, displayText) : displayText
  }

  const replaceTerminalWithTranscript = (terminal: Terminal, transcript: string) => {
    renderedTranscriptRef.current = trimTranscript(transcript)
    pendingWriteRef.current = ''
    if (writeFrameRef.current !== null) {
      window.cancelAnimationFrame(writeFrameRef.current)
      writeFrameRef.current = null
    }
    isWritingRef.current = false
    clearInlineRedrawState()
    terminal.reset()
    terminal.write(formatTerminalChunk(terminal, renderedTranscriptRef.current))
    suppressHydratedChunksUntilRef.current = Date.now() + 1500
  }

  const shouldHydrateTranscript = (currentTranscript: string, nextTranscript: string, connected: boolean) => {
    if (!nextTranscript || nextTranscript === currentTranscript) {
      return false
    }

    if (preserveVisibleBufferRef.current && currentTranscript) {
      return false
    }

    if (!currentTranscript) {
      return true
    }

    if (connected) {
      return false
    }

    if (nextTranscript.length < currentTranscript.length) {
      return true
    }

    if (!nextTranscript.startsWith(currentTranscript)) {
      return true
    }

    return true
  }

  const buildInlineRedrawPrefix = (rows: number) => {
    if (rows <= 1) {
      return '\r\x1b[2K'
    }

    let prefix = '\r'
    for (let index = 1; index < rows; index += 1) {
      prefix += '\x1b[F'
    }
    for (let index = 0; index < rows; index += 1) {
      prefix += '\x1b[2K'
      if (index < rows - 1) {
        prefix += '\x1b[E'
      }
    }
    for (let index = 1; index < rows; index += 1) {
      prefix += '\x1b[F'
    }
    return prefix
  }

  const normalizeInlineRedrawChunk = (terminal: Terminal, value: string) => {
    if (!value.includes('\r')) {
      if (activeInlineRedrawRef.current) {
        inlineRedrawContentRef.current += value
        inlineRedrawRowsRef.current = rowsForDisplayWidth(
          getTerminalCellWidth(inlineRedrawContentRef.current),
          terminal.cols
        )
      }
      if (value.includes('\n')) {
        clearInlineRedrawState()
      }
      return value.replaceAll('\n', '\r\n')
    }

    let normalized = ''
    let cursor = 0

    while (cursor < value.length) {
      const carriageIndex = value.indexOf('\r', cursor)
      const newlineIndex = value.indexOf('\n', cursor)

      if (carriageIndex === -1 && newlineIndex === -1) {
        const tail = value.slice(cursor)
        normalized += tail
        if (activeInlineRedrawRef.current) {
          inlineRedrawContentRef.current += tail
          inlineRedrawRowsRef.current = rowsForDisplayWidth(
            getTerminalCellWidth(inlineRedrawContentRef.current),
            terminal.cols
          )
        }
        break
      }

      const nextBreakIndex = [carriageIndex, newlineIndex]
        .filter((index) => index !== -1)
        .sort((left, right) => left - right)[0]

      const segment = value.slice(cursor, nextBreakIndex)
      normalized += segment
      if (activeInlineRedrawRef.current) {
        inlineRedrawContentRef.current += segment
        inlineRedrawRowsRef.current = rowsForDisplayWidth(
          getTerminalCellWidth(inlineRedrawContentRef.current),
          terminal.cols
        )
      }

      if (nextBreakIndex === carriageIndex && value[nextBreakIndex + 1] === '\n') {
        normalized += '\r\n'
        clearInlineRedrawState()
        cursor = nextBreakIndex + 2
        continue
      }

      if (nextBreakIndex === carriageIndex) {
        normalized += buildInlineRedrawPrefix(inlineRedrawRowsRef.current)
        activeInlineRedrawRef.current = true
        inlineRedrawContentRef.current = ''
        inlineRedrawRowsRef.current = 1
        cursor = nextBreakIndex + 1
        continue
      }

      normalized += '\r\n'
      clearInlineRedrawState()
      cursor = nextBreakIndex + 1
    }

    return normalized
  }

  const syncTerminalSize = (fitAddon: FitAddon, terminal: Terminal, force = false) => {
    const host = hostRef.current
    if (!host) {
      return
    }

    const { width, height } = host.getBoundingClientRect()
    if (width <= 0 || height <= 0) {
      return
    }

    const proposed = fitAddon.proposeDimensions()
    if (!proposed) {
      return
    }

    // xterm's fit calculation can be optimistic by a sliver in Electron split panes.
    // Keep one row of breathing room so full-screen TUIs do not draw their status
    // bars under the file panel/resizer.
    const rows = Math.max(1, proposed.rows - TERMINAL_FIT_GUARD_ROWS)
    if (terminal.cols !== proposed.cols || terminal.rows !== rows) {
      clearInlineRedrawState()
      terminal.resize(proposed.cols, rows)
      terminal.refresh(0, Math.max(terminal.rows - 1, 0))
    }

    const nextSize = {
      cols: terminal.cols,
      rows: terminal.rows,
      width: Math.floor(width),
      height: Math.floor(height)
    }
    const previousSize = lastSyncedSizeRef.current
    if (
      !force
      && (
      previousSize
      && previousSize.cols === nextSize.cols
      && previousSize.rows === nextSize.rows
      && previousSize.width === nextSize.width
      && previousSize.height === nextSize.height
      )
    ) {
      return
    }
    lastSyncedSizeRef.current = nextSize

    void window.termdock?.resizeTerminal(
      tabId,
      nextSize.cols,
      nextSize.rows,
      nextSize.width,
      nextSize.height
    )
  }

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const terminal = new Terminal({
      fontFamily: '"SF Mono", Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.05,
      cursorBlink: true,
      allowProposedApi: true,
      allowTransparency: true,
      scrollback: 6000,
      theme: buildTerminalTheme(false),
      convertEol: true
    })
    const fitAddon = new FitAddon()
    const searchAddon = new SearchAddon({ highlightLimit: 2000 })
    const unicode11Addon = new Unicode11Addon()
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.open(uri, '_blank', 'noopener,noreferrer')
    })
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(searchAddon)
    terminal.loadAddon(unicode11Addon)
    terminal.loadAddon(webLinksAddon)
    terminal.unicode.activeVersion = '11'
    terminal.open(hostRef.current)
    const rendererDisposable = loadAcceleratedRenderer(terminal)
    terminalRef.current = terminal
    searchAddonRef.current = searchAddon

    const searchResultsDisposable = searchAddon.onDidChangeResults(({ resultIndex, resultCount }) => {
      setFindMatchCount(resultCount)
      setActiveFindIndex(resultIndex)
      setFindMiss(resultCount === 0)
    })

    const osc52Disposable = terminal.parser.registerOscHandler(52, async (payload) => {
      const parsed = splitOscPayload(payload)
      if (!parsed || !isOsc52TargetSupported(parsed.target)) {
        return false
      }

      if (parsed.data === '?') {
        const clipboardText = window.termdock?.readClipboardText
          ? await window.termdock.readClipboardText()
          : await navigator.clipboard?.readText?.() ?? ''
        const encoded = encodeBase64Utf8(clipboardText)
        await window.termdock?.writeTerminal(tabId, `\u001b]52;${parsed.target || 'c'};${encoded}\u0007`)
        return true
      }

      const decoded = decodeBase64Utf8(parsed.data)
      if (decoded === null) {
        return false
      }

      if (window.termdock?.writeClipboardText) {
        await window.termdock.writeClipboardText(decoded)
      } else {
        copyText(decoded)
      }
      return true
    })

    syncTerminalSize(fitAddon, terminal)
    clearInlineRedrawState()

    if (bootTextRef.current) {
      replaceTerminalWithTranscript(terminal, bootTextRef.current)
    }

    const resize = (force = false) => {
      syncTerminalSize(fitAddon, terminal, force)
    }

    const scheduleResize = (force = false) => {
      pendingResizeForceRef.current = pendingResizeForceRef.current || force

      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current)
      }

      resizeTimerRef.current = window.setTimeout(() => {
        resizeTimerRef.current = null
        const shouldForce = pendingResizeForceRef.current
        pendingResizeForceRef.current = false
        resize(shouldForce)
      }, TERMINAL_RESIZE_DEBOUNCE_MS)
    }

    const onDataDispose = terminal.onData((data) => {
      if (terminal.hasSelection()) {
        terminal.clearSelection()
      }
      setContextMenu(null)
      void window.termdock?.writeTerminal(tabId, data)
    })

    const onSelectionDispose = terminal.onSelectionChange(() => {
      setHasSelection(terminal.hasSelection())
    })

    const offData = window.termdock?.onTerminalData(({ tabId: nextTabId, chunk }) => {
      if (nextTabId === tabId) {
        if (Date.now() < suppressHydratedChunksUntilRef.current && renderedTranscriptRef.current.endsWith(chunk)) {
          return
        }
        appendRenderedTranscript(chunk)
        scheduleTerminalWrite(formatTerminalChunk(terminal, chunk))
      }
    })

    const offState = window.termdock?.onTerminalState(({ tabId: nextTabId, summary, transcript, connected }) => {
      if (nextTabId === tabId) {
        onStatus?.(localizeTerminalText(summary))
        const isDisconnecting = wasConnectedRef.current && !connected
        if (isDisconnecting) {
          preserveVisibleBufferRef.current = true
        }
        if (shouldHydrateTranscript(renderedTranscriptRef.current, transcript, connected)) {
          replaceTerminalWithTranscript(terminal, transcript)
        }
        if (!wasConnectedRef.current && connected) {
          preserveVisibleBufferRef.current = false
          window.requestAnimationFrame(() => scheduleResize(true))
        }
        if (isDisconnecting) {
          terminal.write(buildExitAlternateScreenSequence(), () => {
            const visibleTranscript = snapshotTerminalBuffer(terminal)
            const disconnectedTranscript = visibleTranscript
              ? `${visibleTranscript}\r\n${t.terminalConnectionClosed}\r\n`
              : `${t.terminalConnectionClosed}\r\n`
            replaceTerminalWithTranscript(terminal, disconnectedTranscript)
          })
        }
        wasConnectedRef.current = connected
      }
    })

    const resizeObserver = new ResizeObserver(() => scheduleResize())
    resizeObserver.observe(hostRef.current)

    const onWindowFocus = () => {
      window.requestAnimationFrame(() => scheduleResize(true))
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        window.requestAnimationFrame(() => scheduleResize(true))
      }
    }

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
    window.addEventListener('focus', onWindowFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    // Ask the main process for the actual PTY size once the terminal is mounted.
    if (!bootedTabs.current.has(tabId)) {
      bootedTabs.current.add(tabId)
      resize()
    }

    return () => {
      onDataDispose.dispose()
      onSelectionDispose.dispose()
      offData?.()
      offState?.()
      if (writeFrameRef.current !== null) {
        window.cancelAnimationFrame(writeFrameRef.current)
      }
      if (resizeTimerRef.current !== null) {
        window.clearTimeout(resizeTimerRef.current)
      }
      writeFrameRef.current = null
      resizeTimerRef.current = null
      pendingResizeForceRef.current = false
      isWritingRef.current = false
      pendingWriteRef.current = ''
      renderedTranscriptRef.current = ''
      suppressHydratedChunksUntilRef.current = 0
      preserveVisibleBufferRef.current = false
      lastSyncedSizeRef.current = null
      clearInlineRedrawState()
      rendererDisposable.dispose()
      searchResultsDisposable.dispose()
      osc52Disposable.dispose()
      resizeObserver.disconnect()
      hostRef.current?.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('focus', onWindowFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      searchAddonRef.current = null
      terminalRef.current = null
      terminal.dispose()
    }
  }, [isMac, onStatus, tabId])

  useEffect(() => {
    bootTextRef.current = bootText
    const terminal = terminalRef.current
    if (!terminal || !shouldHydrateTranscript(renderedTranscriptRef.current, bootText, wasConnectedRef.current)) {
      return
    }

    replaceTerminalWithTranscript(terminal, bootText)
  }, [bootText])

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

    const searchAddon = searchAddonRef.current
    if (!searchAddon) {
      setFindMiss(true)
      setFindMatchCount(0)
      setActiveFindIndex(-1)
      clearFindSelection()
      return
    }

    try {
      const found = searchAddon.findNext(findQuery, buildSearchOptions(true))
      if (!found) {
        setFindMiss(true)
        setFindMatchCount(0)
        setActiveFindIndex(-1)
        clearFindSelection()
      }
    } catch {
      setFindMiss(true)
      setFindMatchCount(0)
      setActiveFindIndex(-1)
      clearFindSelection()
    }
  }, [findCaseSensitive, findOpen, findQuery, findRegex])

  return (
    <>
      <div className="terminal-host">
        <div className="terminal-inner" ref={hostRef} />
      </div>
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
          <button
            type="button"
            className={findCaseSensitive ? 'is-active' : undefined}
            aria-pressed={findCaseSensitive}
            title={t.findCaseSensitive}
            onClick={() => setFindCaseSensitive((value) => !value)}
          >
            Aa
          </button>
          <button
            type="button"
            className={findRegex ? 'is-active' : undefined}
            aria-pressed={findRegex}
            title={t.findRegex}
            onClick={() => setFindRegex((value) => !value)}
          >
            .*
          </button>
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
