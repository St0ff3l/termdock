import { randomUUID } from 'node:crypto'
import { stat, readFile, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Client as BasicFtpClient, FileInfo, FileType } from 'basic-ftp'
import { Client, type ClientChannel, type FileEntry, type SFTPWrapper } from 'ssh2'
import type {
  ConnectionProfile,
  FileSessionController,
  FtpSessionController,
  FtpProfile,
  RemoteFileItem,
  SystemMetrics,
  SshProfile,
  SshSessionController
} from '@termdock/core'

abstract class BaseSessionController implements FileSessionController {
  readonly id: string
  readonly type: 'ssh' | 'ftp'

  protected connected = false

  constructor(
    id: string,
    type: 'ssh' | 'ftp',
    protected readonly profile: ConnectionProfile
  ) {
    this.id = id
    this.type = type
  }

  async connect(): Promise<void> {
    this.connected = true
  }

  async disconnect(): Promise<void> {
    this.connected = false
  }

  getSummary(): string {
    return this.connected
      ? `Connected to ${this.profile.host}:${this.profile.port}`
      : `Ready to connect ${this.profile.host}:${this.profile.port}`
  }

  getRemotePath(): string {
    return this.profile.remotePath
  }

  abstract listRemoteFiles(): Promise<RemoteFileItem[]>
  abstract openRemotePath(path: string): Promise<RemoteFileItem[]>
  abstract readRemoteFile(path: string): Promise<string>
  abstract writeRemoteFile(path: string, content: string): Promise<void>
  abstract uploadFile(localPath: string, remotePath: string, onProgress: (progress: number) => void): Promise<void>
  abstract downloadFile(remotePath: string, localPath: string, onProgress: (progress: number) => void): Promise<void>
}

export class LiveSshSessionController extends BaseSessionController implements SshSessionController {
  readonly type = 'ssh'

  private readonly ssh = new Client()
  private sftp?: SFTPWrapper
  private shellStream?: {
    write(data: string): void
    setWindow(rows: number, cols: number, height: number, width: number): void
    end(): void
  }
  private transcript = ''
  private currentRemotePath: string
  private metrics?: SystemMetrics

  constructor(
    id: string,
    profile: SshProfile,
    private readonly onData: (chunk: string) => void,
    private readonly onStateChange: (summary: string, transcript: string, connected: boolean) => void
  ) {
    super(id, 'ssh', profile)
    this.currentRemotePath = profile.remotePath || '.'
    this.appendSystemMessage('连接主机...\r\n')
  }

  override async connect(): Promise<void> {
    const profile = this.profile as SshProfile
    const privateKey = profile.authType === 'privateKey' && profile.privateKeyPath
      ? await readFile(profile.privateKeyPath, 'utf8')
      : undefined

    await new Promise<void>((resolve, reject) => {
      let settled = false

      this.ssh
        .on('ready', () => {
          this.connected = true
          this.appendSystemMessage('连接主机成功\r\n')
          this.onStateChange(this.getSummary(), this.transcript, true)
          this.ssh.shell(
            {
              term: 'xterm-256color',
              rows: 32,
              cols: 120
            },
            (error: Error | undefined, stream: ClientChannel) => {
              if (error) {
                if (!settled) {
                  settled = true
                  reject(error)
                }
                return
              }

              this.shellStream = stream
              stream.on('data', (chunk: Buffer) => {
                const text = chunk.toString('utf8')
                this.transcript += text
                this.onData(text)
                this.onStateChange(this.getSummary(), this.transcript, true)
              })
              stream.on('close', () => {
                this.connected = false
                this.onStateChange('Shell closed', this.transcript, false)
              })

              if (!settled) {
                settled = true
                resolve()
              }
            }
          )
        })
        .on('error', (error: Error) => {
          this.connected = false
          this.appendSystemMessage(`连接失败: ${error.message}\r\n`)
          if (!settled) {
            settled = true
            reject(error)
          }
          this.onStateChange(`Connection error: ${error.message}`, this.transcript, false)
        })
        .on('close', () => {
          this.connected = false
          this.appendSystemMessage('连接已断开\r\n')
          this.onStateChange('Disconnected', this.transcript, false)
        })
        .connect({
          host: profile.host,
          port: profile.port,
          username: profile.username,
          password: profile.authType === 'password' ? profile.password : undefined,
          privateKey,
          passphrase: profile.passphrase,
          readyTimeout: 15000,
          tryKeyboard: profile.authType === 'password'
        })
    })
  }

  override async disconnect(): Promise<void> {
    this.shellStream?.end()
    this.ssh.end()
    this.connected = false
  }

  getTerminalTranscript(): string {
    return this.transcript
  }

  override getRemotePath(): string {
    return this.currentRemotePath
  }

  getSystemMetrics(): SystemMetrics | undefined {
    return this.metrics
  }

  async write(data: string): Promise<void> {
    this.shellStream?.write(data)
  }

  async resize(cols: number, rows: number): Promise<void> {
    this.shellStream?.setWindow(rows, cols, rows * 16, cols * 8)
  }

  async listRemoteFiles(): Promise<RemoteFileItem[]> {
    return this.readRemoteDirectory(this.currentRemotePath)
  }

  async openRemotePath(nextPath: string): Promise<RemoteFileItem[]> {
    this.currentRemotePath = nextPath
    return this.readRemoteDirectory(this.currentRemotePath)
  }

  async readRemoteFile(targetPath: string): Promise<string> {
    const sftp = await this.ensureSftp()
    return new Promise<string>((resolve, reject) => {
      sftp.readFile(targetPath, 'utf8', (error, data) => {
        if (error) {
          reject(error)
          return
        }
        resolve(typeof data === 'string' ? data : data.toString('utf8'))
      })
    })
  }

  async writeRemoteFile(targetPath: string, content: string): Promise<void> {
    const sftp = await this.ensureSftp()
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile(targetPath, content, 'utf8', (error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  async uploadFile(localPath: string, remotePath: string, onProgress: (progress: number) => void): Promise<void> {
    const sftp = await this.ensureSftp()
    const info = await stat(localPath)
    const total = Math.max(info.size, 1)
    await new Promise<void>((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, {
        step: (transferred) => onProgress(Math.min(99, Math.round((transferred / total) * 100)))
      }, (error) => {
        if (error) {
          reject(error)
          return
        }
        onProgress(100)
        resolve()
      })
    })
  }

  async downloadFile(remotePath: string, localPath: string, onProgress: (progress: number) => void): Promise<void> {
    const sftp = await this.ensureSftp()
    const attrs = await new Promise<{ size?: number }>((resolve, reject) => {
      sftp.stat(remotePath, (error, stats) => {
        if (error || !stats) {
          reject(error ?? new Error(`Failed to stat remote file: ${remotePath}`))
          return
        }
        resolve(stats)
      })
    })
    const total = Math.max(attrs.size ?? 1, 1)
    await new Promise<void>((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, {
        step: (transferred) => onProgress(Math.min(99, Math.round((transferred / total) * 100)))
      }, (error) => {
        if (error) {
          reject(error)
          return
        }
        onProgress(100)
        resolve()
      })
    })
  }

  async refreshSystemMetrics(): Promise<SystemMetrics | undefined> {
    try {
      const raw = await this.execCommand(buildMetricsCommand())
      this.metrics = parseSystemMetrics(raw)
      return this.metrics
    } catch {
      return this.metrics
    }
  }

  private async ensureSftp(): Promise<SFTPWrapper> {
    if (this.sftp) {
      return this.sftp
    }

    return new Promise<SFTPWrapper>((resolve, reject) => {
      this.ssh.sftp((error, sftp) => {
        if (error || !sftp) {
          reject(error ?? new Error('Failed to open SFTP session'))
          return
        }
        this.sftp = sftp
        resolve(sftp)
      })
    })
  }

  private async readRemoteDirectory(targetPath: string): Promise<RemoteFileItem[]> {
    const sftp = await this.ensureSftp()
    const entries = await new Promise<FileEntry[]>((resolve, reject) => {
      sftp.readdir(targetPath, (error, list) => {
        if (error || !list) {
          reject(error ?? new Error(`Failed to read remote directory: ${targetPath}`))
          return
        }
        resolve(list)
      })
    })

    const rows = entries
      .filter((entry) => entry.filename !== '.' && entry.filename !== '..')
      .map((entry) => toRemoteFileItem(targetPath, entry))
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'folder' ? -1 : 1
        }
        return left.name.localeCompare(right.name)
      })

    if (targetPath !== '/') {
      rows.unshift({
        path: parentRemotePath(targetPath),
        name: '..',
        type: 'folder',
        modified: '',
        size: '-',
        permission: '',
        ownerGroup: ''
      })
    }

    return rows
  }

  private async execCommand(command: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.ssh.exec(command, (error, stream) => {
        if (error) {
          reject(error)
          return
        }

        let stdout = ''
        let stderr = ''

        stream.on('data', (chunk: Buffer) => {
          stdout += chunk.toString('utf8')
        })
        stream.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf8')
        })
        stream.on('close', (code?: number) => {
          if (code && code !== 0 && stderr.trim()) {
            reject(new Error(stderr.trim()))
            return
          }
          resolve(stdout)
        })
      })
    })
  }

  private appendSystemMessage(message: string) {
    this.transcript += message
    this.onData(message)
  }
}

export class LiveFtpSessionController extends BaseSessionController implements FtpSessionController {
  readonly type = 'ftp'

  private readonly ftp = new BasicFtpClient(20000)
  private currentRemotePath: string

  constructor(id: string, profile: FtpProfile) {
    super(id, 'ftp', profile)
    this.currentRemotePath = profile.remotePath || '/'
  }

  override async connect(): Promise<void> {
    const profile = this.profile as FtpProfile
    await this.ftp.access({
      host: profile.host,
      port: profile.port,
      user: profile.username,
      password: profile.password,
      secure: profile.secure
    })
    this.connected = true
    try {
      await this.ftp.cd(this.currentRemotePath)
      this.currentRemotePath = await this.ftp.pwd()
    } catch {
      this.currentRemotePath = profile.remotePath || '/'
    }
  }

  override async disconnect(): Promise<void> {
    this.ftp.close()
    this.connected = false
  }

  override getRemotePath(): string {
    return this.currentRemotePath
  }

  async listRemoteFiles(): Promise<RemoteFileItem[]> {
    return this.readRemoteDirectory(this.currentRemotePath)
  }

  async openRemotePath(nextPath: string): Promise<RemoteFileItem[]> {
    await this.ftp.cd(nextPath)
    this.currentRemotePath = await this.ftp.pwd()
    return this.readRemoteDirectory(this.currentRemotePath)
  }

  async readRemoteFile(targetPath: string): Promise<string> {
    const localPath = this.tempFilePath(targetPath)
    try {
      await this.ftp.downloadTo(localPath, targetPath)
      return await readFile(localPath, 'utf8')
    } finally {
      void unlink(localPath).catch(() => undefined)
    }
  }

  async writeRemoteFile(targetPath: string, content: string): Promise<void> {
    const localPath = this.tempFilePath(targetPath)
    try {
      await writeFile(localPath, content, 'utf8')
      await this.ftp.uploadFrom(localPath, targetPath)
    } finally {
      void unlink(localPath).catch(() => undefined)
    }
  }

  async uploadFile(localPath: string, remotePath: string, onProgress: (progress: number) => void): Promise<void> {
    const info = await stat(localPath)
    const total = Math.max(info.size, 1)
    this.ftp.trackProgress((progress) => {
      onProgress(Math.min(99, Math.round((progress.bytes / total) * 100)))
    })
    try {
      await this.ftp.uploadFrom(localPath, remotePath)
      onProgress(100)
    } finally {
      this.ftp.trackProgress()
    }
  }

  async downloadFile(remotePath: string, localPath: string, onProgress: (progress: number) => void): Promise<void> {
    const total = Math.max(await this.ftp.size(remotePath), 1)
    this.ftp.trackProgress((progress) => {
      onProgress(Math.min(99, Math.round((progress.bytes / total) * 100)))
    })
    try {
      await this.ftp.downloadTo(localPath, remotePath)
      onProgress(100)
    } finally {
      this.ftp.trackProgress()
    }
  }

  private async readRemoteDirectory(targetPath: string): Promise<RemoteFileItem[]> {
    const entries = await this.ftp.list(targetPath)
    const rows = entries
      .filter((entry) => entry.name !== '.' && entry.name !== '..')
      .map((entry) => toFtpRemoteFileItem(targetPath, entry))
      .sort((left, right) => {
        if (left.type !== right.type) {
          return left.type === 'folder' ? -1 : 1
        }
        return left.name.localeCompare(right.name)
      })

    if (targetPath !== '/') {
      rows.unshift({
        path: parentRemotePath(targetPath),
        name: '..',
        type: 'folder',
        modified: '',
        size: '-',
        permission: '',
        ownerGroup: ''
      })
    }

    return rows
  }

  private tempFilePath(remotePath: string) {
    return path.join(os.tmpdir(), `termdock-${randomUUID()}-${path.posix.basename(remotePath) || 'remote-file'}`)
  }
}

function toRemoteFileItem(basePath: string, entry: FileEntry): RemoteFileItem {
  const fullPath = path.posix.join(basePath, entry.filename)
  const isDirectory = entry.longname.startsWith('d')
  return {
    path: fullPath,
    name: entry.filename,
    type: isDirectory ? 'folder' : 'file',
    modified: formatTimestamp(entry.attrs.mtime),
    size: isDirectory ? '-' : formatBytes(entry.attrs.size),
    permission: entry.longname.split(/\s+/)[0] ?? '',
    ownerGroup: `${entry.attrs.uid ?? 0}/${entry.attrs.gid ?? 0}`
  }
}

function toFtpRemoteFileItem(basePath: string, entry: FileInfo): RemoteFileItem {
  const fullPath = path.posix.join(basePath, entry.name)
  const isDirectory = entry.type === FileType.Directory || entry.isDirectory
  return {
    path: fullPath,
    name: entry.name,
    type: isDirectory ? 'folder' : 'file',
    modified: entry.modifiedAt ? formatDate(entry.modifiedAt) : entry.rawModifiedAt,
    size: isDirectory ? '-' : formatBytes(entry.size),
    permission: formatFtpPermissions(entry.type, entry.permissions),
    ownerGroup: [entry.user, entry.group].filter(Boolean).join('/') || ''
  }
}

function formatFtpPermissions(type: FileType, permissions?: FileInfo['permissions']) {
  if (!permissions) {
    return type === FileType.Directory ? 'd---------' : '----------'
  }

  return `${type === FileType.Directory ? 'd' : '-'}${formatPermissionGroup(permissions.user)}${formatPermissionGroup(permissions.group)}${formatPermissionGroup(permissions.world)}`
}

function formatPermissionGroup(value = 0) {
  return `${value & FileInfo.UnixPermission.Read ? 'r' : '-'}${value & FileInfo.UnixPermission.Write ? 'w' : '-'}${value & FileInfo.UnixPermission.Execute ? 'x' : '-'}`
}

function parentRemotePath(currentPath: string) {
  const normalized = currentPath.endsWith('/') && currentPath !== '/' ? currentPath.slice(0, -1) : currentPath
  const parent = path.posix.dirname(normalized)
  return parent === '.' ? '/' : parent
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp) {
    return ''
  }
  const date = new Date(timestamp * 1000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatBytes(size = 0) {
  if (!size) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = size
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const digits = value >= 10 || unitIndex === 0 ? 0 : 1
  return `${value.toFixed(digits)} ${units[unitIndex]}`
}

function buildMetricsCommand() {
  return `bash -lc '
read cpu user nice system idle iowait irq softirq steal guest guest_nice < /proc/stat
total1=$((user+nice+system+idle+iowait+irq+softirq+steal))
idle1=$((idle+iowait))
sleep 0.15
read cpu user2 nice2 system2 idle2 iowait2 irq2 softirq2 steal2 guest2 guest_nice2 < /proc/stat
total2=$((user2+nice2+system2+idle2+iowait2+irq2+softirq2+steal2))
idle2sum=$((idle2+iowait2))
diff_total=$((total2-total1))
diff_idle=$((idle2sum-idle1))
if [ "$diff_total" -gt 0 ]; then cpu_pct=$((100*(diff_total-diff_idle)/diff_total)); else cpu_pct=0; fi
ip=$(hostname -I 2>/dev/null | awk "{print \\$1}")
uptime_days=$(awk "{print int(\\$1/86400) \\" 天\\"}" /proc/uptime 2>/dev/null)
load=$(awk "{printf \\"%s, %s, %s\\", \\$1, \\$2, \\$3}" /proc/loadavg 2>/dev/null)
mem=$(free -m 2>/dev/null | awk "/Mem:/ {printf \\"%d|%d|%d\\", \\$3, \\$2, (\\$2>0 ? int(\\$3*100/\\$2) : 0)}")
swap=$(free -m 2>/dev/null | awk "/Swap:/ {printf \\"%d|%d|%d\\", \\$3, \\$2, (\\$2>0 ? int(\\$3*100/\\$2) : 0)}")
ifaces=$(awk -F: "NR>2 {gsub(/ /,\\"\\",\\$1); if (\\$1 != \\"lo\\") print \\$1}" /proc/net/dev | paste -sd, -)
active_iface=$(awk "\\$2 == 00000000 {print \\$1; exit}" /proc/net/route)
[ -z "$active_iface" ] && active_iface=$(echo "$ifaces" | awk -F, "{print \\$1}")
rx1=$(awk -F"[: ]+" -v iface="$active_iface" "\\$1 == iface {print \\$3}" /proc/net/dev)
tx1=$(awk -F"[: ]+" -v iface="$active_iface" "\\$1 == iface {print \\$11}" /proc/net/dev)
sleep 0.15
rx2=$(awk -F"[: ]+" -v iface="$active_iface" "\\$1 == iface {print \\$3}" /proc/net/dev)
tx2=$(awk -F"[: ]+" -v iface="$active_iface" "\\$1 == iface {print \\$11}" /proc/net/dev)
rx_rate=$(( (rx2-rx1) * 1000 / 150 ))
tx_rate=$(( (tx2-tx1) * 1000 / 150 ))
disk=$(df -hP | awk "NR>1 {printf \\"%s|%s/%s\\\\n\\", \\$6, \\$4, \\$2}" | head -n 12)
procs=$(ps -eo rss,pcpu,comm --sort=-rss | awk "NR>1 && NR<6 {printf \\"%.1fM|%s|%s\\\\n\\", \\$1/1024, \\$2, \\$3}")
echo "__IP__\${ip}"
echo "__UPTIME__\${uptime_days}"
echo "__LOAD__\${load}"
echo "__CPU__\${cpu_pct}"
echo "__MEM__\${mem}"
echo "__SWAP__\${swap}"
echo "__IFACES__\${ifaces}"
echo "__ACTIVE_IFACE__\${active_iface}"
echo "__RATES__\${rx_rate}|\${tx_rate}"
echo "__DISK_START__"
echo "$disk"
echo "__DISK_END__"
echo "__PROCS_START__"
echo "$procs"
echo "__PROCS_END__"
'`
}

function parseSystemMetrics(raw: string): SystemMetrics {
  const readLine = (key: string) => raw.split('\n').find((line) => line.startsWith(key))?.slice(key.length) ?? ''
  const readBlock = (start: string, end: string) => {
    const startIndex = raw.indexOf(start)
    const endIndex = raw.indexOf(end)
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
      return []
    }
    return raw
      .slice(startIndex + start.length, endIndex)
      .trim()
      .split('\n')
      .filter(Boolean)
  }

  const [memUsed, memTotal, memPercent] = readLine('__MEM__').split('|')
  const [swapUsed, swapTotal, swapPercent] = readLine('__SWAP__').split('|')
  const [rxRate, txRate] = readLine('__RATES__').split('|')
  const interfaces = readLine('__IFACES__').split(',').filter(Boolean)
  const diskRows = readBlock('__DISK_START__', '__DISK_END__').map((line) => {
    const [diskPath, usage] = line.split('|')
    return { path: diskPath, usage }
  })
  const topProcesses = readBlock('__PROCS_START__', '__PROCS_END__').map((line) => {
    const [memory, cpu, command] = line.split('|')
    return { memory, cpu, command }
  })

  return {
    ip: readLine('__IP__'),
    uptime: readLine('__UPTIME__') || '-',
    load: readLine('__LOAD__') || '-',
    cpuPercent: Number(readLine('__CPU__')) || 0,
    memoryPercent: Number(memPercent) || 0,
    memoryUsage: memTotal ? `${formatMegabytes(memUsed)}/${formatMegabytes(memTotal)}` : '0/0',
    swapPercent: Number(swapPercent) || 0,
    swapUsage: swapTotal ? `${formatMegabytes(swapUsed)}/${formatMegabytes(swapTotal)}` : '0/0',
    diskRows,
    networkInterfaces: interfaces,
    activeNetworkInterface: readLine('__ACTIVE_IFACE__') || interfaces[0] || 'eth0',
    networkRates: {
      rx: formatRate(Number(rxRate) || 0),
      tx: formatRate(Number(txRate) || 0)
    },
    networkSamples: buildSamples(Number(rxRate) || 0, Number(txRate) || 0),
    topProcesses
  }
}

function formatMegabytes(value?: string) {
  const numeric = Number(value) || 0
  if (numeric >= 1024) {
    return `${(numeric / 1024).toFixed(1)}G`
  }
  return `${numeric}M`
}

function formatRate(bytesPerSecond: number) {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${Math.round(bytesPerSecond / 1024 / 1024)}M`
  }
  if (bytesPerSecond >= 1024) {
    return `${Math.round(bytesPerSecond / 1024)}K`
  }
  return `${bytesPerSecond}B`
}

function buildSamples(rx: number, tx: number) {
  const rxBase = Math.max(1, rx)
  const txBase = Math.max(1, tx)
  return Array.from({ length: 18 }, (_value, index) => {
    const wave = 0.55 + ((index % 6) * 0.08)
    return {
      rx: Math.round(rxBase * wave),
      tx: Math.round(txBase * (1 - (index % 5) * 0.07 + 0.25))
    }
  })
}
