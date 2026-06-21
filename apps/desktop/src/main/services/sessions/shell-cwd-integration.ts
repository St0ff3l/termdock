import path from 'node:path'

const OSC_7_PREFIX = '\u001b]7;'
const OSC_7_PATTERN = /\u001b]7;file:\/\/([^\u0007\u001b]*)(?:\u0007|\u001b\\)/g
const MAX_REPORTED_CWD_LENGTH = 4096

export type RemoteShellKind = 'bash' | 'zsh' | 'fish' | 'posix'

export class ShellCwdTracker {
  private buffer = ''

  feed(chunk: string): string[] {
    const combined = `${this.buffer}${chunk}`
    const paths: string[] = []
    let lastCompleteEnd = 0

    OSC_7_PATTERN.lastIndex = 0
    for (const match of combined.matchAll(OSC_7_PATTERN)) {
      lastCompleteEnd = (match.index ?? 0) + match[0].length
      const cwd = parseOsc7Payload(match[1] ?? '')
      if (cwd) {
        paths.push(cwd)
      }
    }

    if (lastCompleteEnd > 0) {
      this.buffer = combined.slice(lastCompleteEnd)
    } else {
      const markerStart = combined.lastIndexOf(OSC_7_PREFIX)
      this.buffer = markerStart >= 0
        ? combined.slice(markerStart)
        : combined.slice(-OSC_7_PREFIX.length)
    }

    if (this.buffer.length > 4096) {
      this.buffer = this.buffer.slice(-4096)
    }

    return paths
  }
}

export function detectRemoteShellKind(shellPath: string): RemoteShellKind {
  const shellName = path.posix.basename(shellPath.trim()).toLowerCase()
  if (shellName === 'zsh') return 'zsh'
  if (shellName === 'fish') return 'fish'
  if (shellName === 'bash') return 'bash'
  return 'posix'
}

export function buildShellCwdIntegrationCommand(shellKind: RemoteShellKind): string {
  if (shellKind === 'fish') {
    return [
      'if not functions -q __termdock_report_cwd',
      'function __termdock_report_cwd --on-variable PWD',
      "printf '\\e]7;file://%s\\a' (pwd -P)",
      'end',
      'end',
      '__termdock_report_cwd'
    ].join('; ')
  }

  const reporter = "__termdock_report_cwd() { printf '\\033]7;file://%s\\007' \"$(pwd -P)\"; }"
  if (shellKind === 'zsh') {
    return [
      reporter,
      'autoload -Uz add-zsh-hook 2>/dev/null',
      'add-zsh-hook -D precmd __termdock_report_cwd 2>/dev/null',
      'add-zsh-hook precmd __termdock_report_cwd 2>/dev/null',
      '__termdock_report_cwd'
    ].join('; ')
  }

  return [
    reporter,
    "case \"$PS1\" in *'__termdock_report_cwd'*) ;; *) PS1='$(__termdock_report_cwd)'\"$PS1\" ;; esac",
    '__termdock_report_cwd'
  ].join('; ')
}

function parseOsc7Payload(payload: string): string | null {
  if (payload.length > MAX_REPORTED_CWD_LENGTH) {
    return null
  }

  const pathStart = payload.indexOf('/')
  if (pathStart < 0) {
    return null
  }

  const rawPath = payload.slice(pathStart)
  let decodedPath = rawPath
  try {
    decodedPath = decodeURIComponent(rawPath)
  } catch {
    // Some shells report a raw path containing a literal percent sign.
  }

  if (!decodedPath.startsWith('/')) {
    return null
  }

  return path.posix.normalize(decodedPath)
}
