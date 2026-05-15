import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function TerminalView({
  tabId,
  initialText,
  onStatus
}: {
  tabId: string
  initialText: string
  onStatus(message: string | null): void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const initialTextRef = useRef(initialText)
  const bootedTabs = useRef(new Set<string>())

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const terminal = new Terminal({
      fontFamily: '"SF Mono", Menlo, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.45,
      cursorBlink: true,
      theme: {
        background: '#17384a',
        foreground: '#e8f3f7',
        cursor: '#c9f8ff',
        selectionBackground: 'rgba(160, 220, 255, 0.26)'
      }
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(hostRef.current)
    fitAddon.fit()

    if (initialTextRef.current) {
      terminal.write(initialTextRef.current)
    }

    const resize = () => {
      fitAddon.fit()
      void window.termdock?.resizeTerminal(tabId, terminal.cols, terminal.rows)
    }

    const onDataDispose = terminal.onData((data) => {
      void window.termdock?.writeTerminal(tabId, data)
    })

    const onResizeDispose = terminal.onResize(({ cols, rows }) => {
      void window.termdock?.resizeTerminal(tabId, cols, rows)
    })

    const offData = window.termdock?.onTerminalData(({ tabId: nextTabId, chunk }) => {
      if (nextTabId === tabId) {
        terminal.write(chunk)
      }
    })

    const offState = window.termdock?.onTerminalState(({ tabId: nextTabId, summary, connected }) => {
      if (nextTabId === tabId) {
        onStatus(summary)
        if (!connected) {
          terminal.writeln('\r\n[connection closed]')
        }
      }
    })

    const resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(hostRef.current)

    // Ask the main process for the actual PTY size once the terminal is mounted.
    if (!bootedTabs.current.has(tabId)) {
      bootedTabs.current.add(tabId)
      resize()
    }

    return () => {
      onDataDispose.dispose()
      onResizeDispose.dispose()
      offData?.()
      offState?.()
      resizeObserver.disconnect()
      terminal.dispose()
    }
  }, [onStatus, tabId])

  return <div className="terminal-host" ref={hostRef} />
}
