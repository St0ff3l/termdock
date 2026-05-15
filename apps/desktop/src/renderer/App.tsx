import { useEffect, useState, useTransition, type DragEvent, type FormEvent, type MouseEvent } from 'react'
import type {
  ConnectionProfile,
  CreateProfileInput,
  LocalFileItem,
  RemoteFileItem,
  SessionSnapshot,
  SystemMetrics,
  TransferTask,
  WorkspaceSnapshot,
  WorkspaceTab
} from '@termdock/core'
import { t } from './i18n'
import { TerminalView } from './components/TerminalView'

const emptyState: WorkspaceSnapshot = {
  profiles: [],
  tabs: [],
  activeTabId: null,
  transfers: [],
  sessions: {}
}

const localPreviewFiles: LocalFileItem[] = [
  { path: '/Users/stoffel', name: '..', type: 'folder', modified: '2026/05/15 18:44', size: '-' },
  { path: '/Users/stoffel/Downloads', name: 'Downloads', type: 'folder', modified: '2026/05/15 18:44', size: '-' },
  { path: '/Users/stoffel/Desktop', name: 'Desktop', type: 'folder', modified: '2026/05/15 18:32', size: '-' },
  { path: '/Users/stoffel/release.tar.gz', name: 'release.tar.gz', type: 'file', modified: '2026/05/15 17:18', size: '742 MB' },
  { path: '/Users/stoffel/backup.sql.gz', name: 'backup.sql.gz', type: 'file', modified: '2026/05/15 16:02', size: '1.1 GB' }
]

const previewLocalPath = '/Users/stoffel'

const previewState: WorkspaceSnapshot = {
  profiles: [
    {
      id: 'preview-profile-ssh',
      type: 'ssh',
      name: 'SynologyNAS',
      host: '114.66.28.185',
      port: 22,
      username: 'Stoffel',
      authType: 'privateKey',
      privateKeyPath: '~/.ssh/id_ed25519',
      group: '默认',
      sftpEnabled: true,
      remotePath: '/'
    },
    {
      id: 'preview-profile-ftp',
      type: 'ftp',
      name: 'archive-ftp',
      host: 'ftp.example.net',
      port: 21,
      username: 'deploy',
      secure: false,
      group: 'FTP',
      remotePath: '/incoming'
    }
  ],
  tabs: [],
  activeTabId: null,
  transfers: [],
  sessions: {}
}

const defaultForm: CreateProfileInput = {
  type: 'ssh',
  name: '',
  host: '',
  port: 22,
  username: '',
  group: '默认',
  remotePath: '/',
  note: '',
  password: '',
  privateKeyPath: '',
  passphrase: '',
  authType: 'password',
  encoding: 'UTF-8',
  backspaceKey: 'ASCII',
  deleteKey: 'VT220',
  enableExecChannel: true,
  secure: false
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>(emptyState)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [showConnectionManager, setShowConnectionManager] = useState(false)
  const [form, setForm] = useState<CreateProfileInput>(defaultForm)
  const [terminalSummary, setTerminalSummary] = useState<string | null>(null)
  const [localPath, setLocalPath] = useState(previewLocalPath)
  const [localItems, setLocalItems] = useState<LocalFileItem[]>(localPreviewFiles)
  const [homeTabs, setHomeTabs] = useState([{ id: 'home-1' }])
  const [activeHomeTabId, setActiveHomeTabId] = useState<string | null>('home-1')
  const [nextHomeTabNumber, setNextHomeTabNumber] = useState(2)
  const [tabOrder, setTabOrder] = useState<string[]>(['home:home-1'])
  const [draggingTabKey, setDraggingTabKey] = useState<string | null>(null)
  const desktopApi = window.termdock
  const isDesktopRuntime = Boolean(desktopApi?.isDesktop)

  useEffect(() => {
    if (!desktopApi) {
      setWorkspace(previewState)
      setLocalPath(previewLocalPath)
      setLocalItems(localPreviewFiles)
      setError(t.browserPreview)
      return
    }

    desktopApi
      .getSnapshot()
      .then(setWorkspace)
      .catch((err: Error) => setError(err.message))
  }, [desktopApi])

  useEffect(() => {
    if (!desktopApi) {
      return
    }

    const offSnapshot = desktopApi.onWorkspaceSnapshot((snapshot) => {
      applySnapshot(snapshot)
    })

    desktopApi
      .listLocalDirectory()
      .then(({ path, items }) => {
        setLocalPath(path)
        setLocalItems(withParentRow(path, items))
      })
      .catch(() => setError(t.localLoadFailed))

    return () => {
      offSnapshot()
    }
  }, [desktopApi])

  const activeTab = workspace.tabs.find((tab) => tab.id === workspace.activeTabId) ?? null
  const activeSession = activeHomeTabId ? null : activeTab ? workspace.sessions[activeTab.id] : null
  const activeProfile = !activeHomeTabId && activeTab
    ? workspace.profiles.find((profile) => profile.id === activeTab.profileId) ?? null
    : null

  useEffect(() => {
    setTerminalSummary(activeSession?.summary ?? null)
  }, [activeSession?.summary])

  useEffect(() => {
    const allKeys = [
      ...homeTabs.map((tab) => homeTabKey(tab.id)),
      ...workspace.tabs.map((tab) => sessionTabKey(tab.id))
    ]

    setTabOrder((prev) => {
      const kept = prev.filter((key) => allKeys.includes(key))
      const missing = allKeys.filter((key) => !kept.includes(key))
      return [...kept, ...missing]
    })
  }, [homeTabs, workspace.tabs])

  const recentProfiles = workspace.profiles.slice(0, 12)

  const applySnapshot = (snapshot: WorkspaceSnapshot) => {
    startTransition(() => {
      setWorkspace(snapshot)
      setError(null)
      setFormError(null)
    })
  }

  const updateForm = (
    updater: CreateProfileInput | ((prev: CreateProfileInput) => CreateProfileInput)
  ) => {
    setForm((prev) => (typeof updater === 'function' ? updater(prev) : updater))
    setFormError(null)
  }

  const handleCreateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.name || !form.host || !form.username || !form.group || !form.remotePath) {
      setFormError(t.fillRequired)
      return
    }

    if (form.type === 'ssh' && form.authType === 'password' && !form.password) {
      setFormError('请填写 SSH 密码。')
      return
    }

    if (form.type === 'ssh' && form.authType === 'privateKey' && !form.privateKeyPath) {
      setFormError('请选择或填写私钥路径。')
      return
    }

    if (!desktopApi) {
      setFormError(t.desktopOnlyCreate)
      return
    }

    try {
      const snapshot = await desktopApi.createProfile({
        ...form,
        port: Number(form.port)
      })
      applySnapshot(snapshot)
      setShowForm(false)
      setForm(defaultForm)
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  const handleOpenProfile = async (profileId: string) => {
    if (!desktopApi) {
      return
    }

    try {
      const snapshot = await desktopApi.openProfile(profileId)
      applySnapshot(snapshot)
      setActiveHomeTabId(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleDeleteProfile = async (
    event: MouseEvent<HTMLButtonElement>,
    profileId: string
  ) => {
    event.stopPropagation()
    if (!desktopApi) {
      setError(t.desktopOnlyDelete)
      return
    }

    try {
      const snapshot = await desktopApi.deleteProfile(profileId)
      applySnapshot(snapshot)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleActivateTab = async (tabId: string) => {
    if (!desktopApi) {
      return
    }

    try {
      const snapshot = await desktopApi.activateTab(tabId)
      applySnapshot(snapshot)
      setActiveHomeTabId(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleCloseTab = async (event: MouseEvent<HTMLButtonElement>, tabId: string) => {
    event.stopPropagation()
    if (!desktopApi) {
      return
    }

    try {
      const snapshot = await desktopApi.closeTab(tabId)
      applySnapshot(snapshot)
      if (snapshot.activeTabId === null) {
        setActiveHomeTabId((prev) => prev ?? homeTabs.at(-1)?.id ?? 'home-1')
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleActivateHome = (homeTabId: string) => {
    startTransition(() => {
      setError(null)
      setActiveHomeTabId(homeTabId)
    })
  }

  const handleAddHomeTab = () => {
    const nextId = `home-${nextHomeTabNumber}`
    const nextKey = homeTabKey(nextId)
    const activeKey = activeHomeTabId
      ? homeTabKey(activeHomeTabId)
      : workspace.activeTabId
        ? sessionTabKey(workspace.activeTabId)
        : null

    setHomeTabs((prev) => [...prev, { id: nextId }])
    setTabOrder((prev) => insertAfterActive(prev, activeKey, nextKey))
    setNextHomeTabNumber((prev) => prev + 1)
    setActiveHomeTabId(nextId)
    setError(null)
  }

  const handleCloseHomeTab = (event: MouseEvent<HTMLButtonElement>, homeTabId: string) => {
    event.stopPropagation()

    setHomeTabs((prev) => {
      const remaining = prev.filter((tab) => tab.id !== homeTabId)
      if (remaining.length === 0) {
        setActiveHomeTabId('home-1')
        setNextHomeTabNumber(2)
        setTabOrder((prev) => {
          const filtered = prev.filter((key) => key !== homeTabKey(homeTabId))
          return filtered.includes('home:home-1') ? filtered : ['home:home-1', ...filtered]
        })
        return [{ id: 'home-1' }]
      }

      if (activeHomeTabId === homeTabId) {
        setActiveHomeTabId(remaining.at(-1)?.id ?? null)
      }

      return remaining
    })
  }

  const handleDragStart = (tabKey: string) => {
    setDraggingTabKey(tabKey)
  }

  const handleDragEnter = (targetKey: string) => {
    setTabOrder((prev) => reorderTabKeys(prev, draggingTabKey, targetKey))
  }

  const handleDragEnd = () => {
    setDraggingTabKey(null)
  }

  const orderedTabs = tabOrder
    .map((key) => {
      if (key.startsWith('home:')) {
        const id = key.slice(5)
        const homeTab = homeTabs.find((tab) => tab.id === id)
        return homeTab ? { key, kind: 'home' as const, id: homeTab.id } : null
      }

      const id = key.slice(8)
      const sessionTab = workspace.tabs.find((tab) => tab.id === id)
      return sessionTab ? { key, kind: 'session' as const, tab: sessionTab } : null
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const handleDropUpload = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const fileNames = Array.from(event.dataTransfer.files).map((file) => file.name).filter(Boolean)
    if (!fileNames.length) {
      setError(t.desktopOnlyUpload)
      return
    }

    if (!desktopApi) {
      setError(t.desktopOnlyUpload)
      return
    }

    try {
      const snapshot = await desktopApi.queueUpload(fileNames)
      applySnapshot(snapshot)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleOpenLocalItem = async (item: LocalFileItem) => {
    if (item.type !== 'folder') {
      return
    }

    if (!desktopApi) {
      setLocalPath(item.path)
      return
    }

    try {
      const { path, items } = await desktopApi.listLocalDirectory(item.path)
      setLocalPath(path)
      setLocalItems(withParentRow(path, items))
    } catch {
      setError(t.localLoadFailed)
    }
  }

  return (
    <>
      <div className="fs-shell">
        <aside className="fs-sidebar">
          <SystemPanel activeProfile={activeProfile} activeSession={activeSession} />
          <DiskPanel activeSession={activeSession} />
        </aside>

        <main className="fs-main">
          <header className="fs-tabbar">
            <button
              className="folder-button"
              type="button"
              title={t.openConnection}
              onClick={() => setShowConnectionManager(true)}
            >
              ▰
            </button>
            <div className="fs-tabs">
              {orderedTabs.map((entry, index) => (
                entry.kind === 'home' ? (
                  <div
                    key={entry.key}
                    className={`fs-tab ${activeHomeTabId === entry.id ? 'active' : ''}`}
                    draggable
                    onClick={() => handleActivateHome(entry.id)}
                    onDragStart={() => handleDragStart(entry.key)}
                    onDragEnter={() => handleDragEnter(entry.key)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => event.preventDefault()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        handleActivateHome(entry.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span>{index + 1}</span>
                    <strong>{t.newTab}</strong>
                    <button
                      aria-label={`Close ${t.newTab}`}
                      className="tab-close"
                      onClick={(event) => handleCloseHomeTab(event, entry.id)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div
                    key={entry.key}
                    className={`fs-tab ${entry.tab.id === workspace.activeTabId ? 'active' : ''}`}
                    draggable
                    onClick={() => handleActivateTab(entry.tab.id)}
                    onDragStart={() => handleDragStart(entry.key)}
                    onDragEnter={() => handleDragEnter(entry.key)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => event.preventDefault()}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        handleActivateTab(entry.tab.id)
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span>{index + 1}</span>
                    <strong>{entry.tab.title}</strong>
                    <span className={`tab-dot ${tabStatusClass(entry.tab.status)}`} />
                    <button
                      aria-label={`Close ${entry.tab.title}`}
                      className="tab-close"
                      onClick={(event) => handleCloseTab(event, entry.tab.id)}
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                )
              ))}
              <button className="add-tab" type="button" onClick={handleAddHomeTab}>+</button>
            </div>
            <div className="window-tools">
              <span>▦</span>
              <span>☰</span>
            </div>
          </header>

          {error ? <div className="status-message">{error}</div> : null}

          {activeTab && activeSession ? (
            <SessionWorkspace
              activeTab={activeTab}
              activeSession={activeSession}
              terminalSummary={terminalSummary}
              localItems={localItems}
              localPath={localPath}
              onOpenLocalItem={handleOpenLocalItem}
              onOpenRemoteItem={async (item) => {
                if (item.type !== 'folder' || !desktopApi) {
                  return
                }

                try {
                  const snapshot = await desktopApi.openRemotePath(activeTab.id, item.path)
                  applySnapshot(snapshot)
                } catch (err) {
                  setError((err as Error).message)
                }
              }}
              onTerminalSummary={setTerminalSummary}
              onDropUpload={handleDropUpload}
            />
          ) : (
            <HomeWorkspace
              profiles={recentProfiles}
              isDesktopRuntime={isDesktopRuntime}
              onCreate={() => setShowForm(true)}
              onOpen={handleOpenProfile}
              onDelete={handleDeleteProfile}
            />
          )}

          <TransferBar transfers={workspace.transfers} isPending={isPending} />
        </main>
      </div>

      {showConnectionManager ? (
        <ConnectionManagerModal
          profiles={workspace.profiles}
          onClose={() => setShowConnectionManager(false)}
          onCreate={() => {
            setShowConnectionManager(false)
            setShowForm(true)
          }}
          onOpen={(profileId) => {
            setShowConnectionManager(false)
            void handleOpenProfile(profileId)
          }}
        />
      ) : null}

      {showForm ? (
        <ConnectionModal
          errorMessage={formError}
          form={form}
          setForm={updateForm}
          onSubmit={handleCreateProfile}
          onClose={() => {
            setShowForm(false)
            setFormError(null)
          }}
        />
      ) : null}
    </>
  )
}

function SystemPanel({
  activeProfile,
  activeSession
}: {
  activeProfile: ConnectionProfile | null
  activeSession: SessionSnapshot | null
}) {
  const metrics = activeSession?.systemMetrics
  return (
    <section className="sys-card">
      <div className="sync-row">
        <span>{t.syncStatus}</span>
        <span className="sync-dot" />
      </div>
      <div className="ip-row">
        <span>{t.ip}</span>
        <strong>{metrics?.ip || activeProfile?.host || '-'}</strong>
      </div>
      <button className="copy-link" type="button">复制</button>
      <button className="system-title" type="button">{t.systemInfo}</button>
      <div className="metric-line"><span>{t.running}</span><strong>{metrics?.uptime ?? '-'}</strong></div>
      <div className="metric-line"><span>{t.load}</span><strong>{metrics?.load ?? '-'}</strong></div>
      <Meter label={t.cpu} value={metrics?.cpuPercent ?? 0} tone="green" caption={metrics ? `${metrics.cpuPercent}%` : '0%'} />
      <Meter label={t.memory} value={metrics?.memoryPercent ?? 0} tone="orange" caption={metrics?.memoryUsage ?? '0/0'} />
      <Meter label={t.swap} value={metrics?.swapPercent ?? 0} tone="yellow" caption={metrics?.swapUsage ?? '0/0'} />
      <div className="mini-tabs">
        <span>{t.memory}</span>
        <span>{t.cpu}</span>
        <span>{t.command}</span>
      </div>
      <ProcessTable rows={metrics?.topProcesses ?? []} />
      <NetworkPanel metrics={metrics} />
    </section>
  )
}

function Meter({ label, value, tone, caption }: { label: string; value: number; tone: string; caption: string }) {
  return (
    <div className="meter-row">
      <span>{label}</span>
      <div className="meter-track"><i className={`meter-fill ${tone}`} style={{ width: `${value}%` }} /></div>
      <strong>{caption}</strong>
    </div>
  )
}

function DiskPanel({ activeSession }: { activeSession: SessionSnapshot | null }) {
  const rows = activeSession?.systemMetrics?.diskRows ?? []

  return (
    <section className="disk-table">
      <div className="disk-head"><span>{t.path}</span><span>{t.availableSize}</span></div>
      {rows.map((row) => (
        <div className="disk-row" key={row.path}><span>{row.path}</span><span>{row.usage}</span></div>
      ))}
    </section>
  )
}

function ProcessTable({ rows }: { rows: SystemMetrics['topProcesses'] }) {
  return (
    <div className="process-table">
      {rows.length ? rows.map((row) => (
        <div className="process-row" key={`${row.command}-${row.memory}`}>
          <span>{row.memory}</span>
          <span>{row.cpu}</span>
          <span>{row.command}</span>
        </div>
      )) : <div className="process-empty" />}
    </div>
  )
}

function NetworkPanel({ metrics }: { metrics?: SystemMetrics }) {
  const [selectedInterface, setSelectedInterface] = useState(metrics?.activeNetworkInterface ?? '')

  useEffect(() => {
    setSelectedInterface(metrics?.activeNetworkInterface ?? '')
  }, [metrics?.activeNetworkInterface])

  return (
    <>
      <div className="network-panel">
        <div>
          <span className="up">↑{metrics?.networkRates.tx ?? '0B'}</span>
          <span className="down">↓{metrics?.networkRates.rx ?? '0B'}</span>
        </div>
        <select
          className="network-select"
          value={selectedInterface}
          onChange={(event) => setSelectedInterface(event.target.value)}
        >
          {(metrics?.networkInterfaces.length ? metrics.networkInterfaces : ['-']).map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>
      <div className="grid-chart">
        {(metrics?.networkSamples.length ? metrics.networkSamples : Array.from({ length: 18 }, () => ({ rx: 0, tx: 0 }))).map((sample, index) => {
          const maxValue = Math.max(...(metrics?.networkSamples ?? [{ rx: 1, tx: 1 }]).flatMap((item) => [item.rx, item.tx]), 1)
          return (
            <div className="grid-chart-bar" key={`${selectedInterface}-${index}`}>
              <i className="tx-bar" style={{ height: `${Math.max(4, (sample.tx / maxValue) * 100)}%` }} />
              <i className="rx-bar" style={{ height: `${Math.max(4, (sample.rx / maxValue) * 100)}%` }} />
            </div>
          )
        })}
      </div>
    </>
  )
}

function HomeWorkspace({
  profiles,
  isDesktopRuntime,
  onCreate,
  onOpen,
  onDelete
}: {
  profiles: ConnectionProfile[]
  isDesktopRuntime: boolean
  onCreate(): void
  onOpen(profileId: string): void
  onDelete(event: MouseEvent<HTMLButtonElement>, profileId: string): void
}) {
  return (
    <section className="home-workspace">
      <div className="quick-panel">
        <div className="quick-header">
          <strong>{t.quickConnect}</strong>
          <div>
            <button className="flat-button" type="button" disabled={!isDesktopRuntime} onClick={onCreate}>{t.newConnection}</button>
            <button className="flat-button" type="button">{t.clear}</button>
          </div>
        </div>
        <div className="quick-list">
          {profiles.map((profile) => (
            <div
              className="quick-row"
              key={profile.id}
              onClick={() => onOpen(profile.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onOpen(profile.id)
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span className="host-icon">▣</span>
              <strong>{profile.name}</strong>
              <span>{profile.remotePath}</span>
              <span>{profile.username}</span>
              <small>{profile.type.toUpperCase()}</small>
              <button className="row-delete" type="button" onClick={(event) => onDelete(event, profile.id)}>×</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function ConnectionManagerModal({
  profiles,
  onClose,
  onCreate,
  onOpen
}: {
  profiles: ConnectionProfile[]
  onClose(): void
  onCreate(): void
  onOpen(profileId: string): void
}) {
  return (
    <div className="modal-backdrop">
      <div className="modal-card manager-modal">
        <div className="modal-header">
          <span>连接管理器</span>
          <button className="icon-button" onClick={onClose} type="button">×</button>
        </div>
        <div className="manager-toolbar">
          <button className="primary-button" type="button" onClick={onCreate}>新建连接</button>
        </div>
        <div className="manager-table">
          <div className="manager-head">
            <span>名称</span>
            <span>主机</span>
            <span>端口</span>
            <span>用户</span>
            <span>类型</span>
          </div>
          {profiles.map((profile) => (
            <button
              className="manager-row"
              key={profile.id}
              type="button"
              onDoubleClick={() => onOpen(profile.id)}
              onClick={() => onOpen(profile.id)}
            >
              <span>{profile.name}</span>
              <span>{profile.host}</span>
              <span>{profile.port}</span>
              <span>{profile.username}</span>
              <span>{profile.type.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionWorkspace({
  activeTab,
  activeSession,
  terminalSummary,
  localItems,
  localPath,
  onOpenLocalItem,
  onOpenRemoteItem,
  onTerminalSummary,
  onDropUpload
}: {
  activeTab: WorkspaceTab
  activeSession: SessionSnapshot
  terminalSummary: string | null
  localItems: LocalFileItem[]
  localPath: string
  onOpenLocalItem(item: LocalFileItem): void
  onOpenRemoteItem(item: RemoteFileItem): void
  onTerminalSummary(message: string | null): void
  onDropUpload(event: DragEvent<HTMLDivElement>): void
}) {
  const isFileOnly = activeTab.layout === 'file-only'

  return (
    <section className={`session-workspace ${isFileOnly ? 'file-only' : ''}`}>
      {!isFileOnly ? (
        <div className="terminal-area">
          <TerminalView
            tabId={activeTab.id}
            initialText={activeSession.terminalTranscript ?? ''}
            onStatus={onTerminalSummary}
          />
          <div className="terminal-summary-bar">{terminalSummary ?? activeSession.summary}</div>
        </div>
      ) : null}
      <FileManager
        activeSession={activeSession}
        localItems={localItems}
        localPath={localPath}
        onOpenLocalItem={onOpenLocalItem}
        onOpenRemoteItem={onOpenRemoteItem}
        onDropUpload={onDropUpload}
      />
    </section>
  )
}

function FileManager({
  activeSession,
  localItems,
  localPath,
  onOpenLocalItem,
  onOpenRemoteItem,
  onDropUpload
}: {
  activeSession: SessionSnapshot
  localItems: LocalFileItem[]
  localPath: string
  onOpenLocalItem(item: LocalFileItem): void
  onOpenRemoteItem(item: RemoteFileItem): void
  onDropUpload(event: DragEvent<HTMLDivElement>): void
}) {
  return (
    <div className="file-manager" onDragOver={(event) => event.preventDefault()} onDrop={onDropUpload}>
      <div className="file-tabs">
        <button className="active" type="button">{t.file}</button>
        <button type="button">{t.command}</button>
      </div>
      <div className="file-toolbar">
        <span>{activeSession.remotePath}</span>
        <div>
          <button type="button">{t.history}</button>
          <button type="button">↻</button>
          <button type="button">⇧</button>
          <button type="button">⇩</button>
          <button type="button">{t.upload}</button>
        </div>
      </div>
      <div className="file-split">
        <div className="local-pane">
          <div className="pane-title">{t.localComputer}<span>{localPath}</span></div>
          <LocalFileTable rows={localItems} onOpenItem={onOpenLocalItem} />
        </div>
        <div className="remote-pane">
          <div className="pane-title">{t.remoteHost}<span>{t.dragUpload}</span></div>
          <FileTable rows={activeSession.remoteFiles} onOpenItem={onOpenRemoteItem} />
        </div>
      </div>
    </div>
  )
}

function FileTable({
  rows,
  compact = false,
  onOpenItem
}: {
  rows: RemoteFileItem[]
  compact?: boolean
  onOpenItem?(item: RemoteFileItem): void
}) {
  return (
    <table className={`fs-file-table ${compact ? 'compact' : ''}`}>
      <thead>
        <tr>
          <th>{t.fileName}</th>
          {!compact ? <th>{t.size}</th> : null}
          {!compact ? <th>{t.type}</th> : null}
          {!compact ? <th>{t.modifiedAt}</th> : null}
          {!compact ? <th>{t.permission}</th> : null}
          {!compact ? <th>{t.ownerGroup}</th> : null}
        </tr>
      </thead>
      <tbody>
        {rows.length ? rows.map((row) => (
          <tr
            key={row.path}
            className={row.type === 'folder' ? 'is-folder' : ''}
            onDoubleClick={() => onOpenItem?.(row)}
          >
            <td><span className="file-icon">{row.type === 'folder' ? '📁' : '▤'}</span>{row.name}</td>
            {!compact ? <td>{row.size}</td> : null}
            {!compact ? <td>{row.type === 'folder' ? t.folder : row.type}</td> : null}
            {!compact ? <td>{row.modified}</td> : null}
            {!compact ? <td>{row.permission ?? ''}</td> : null}
            {!compact ? <td>{row.ownerGroup ?? ''}</td> : null}
          </tr>
        )) : (
          <tr><td colSpan={compact ? 1 : 6}>{t.emptyFiles}</td></tr>
        )}
      </tbody>
    </table>
  )
}

function LocalFileTable({
  rows,
  onOpenItem
}: {
  rows: LocalFileItem[]
  onOpenItem(item: LocalFileItem): void
}) {
  return (
    <table className="fs-file-table compact">
      <thead>
        <tr>
          <th>{t.fileName}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={`${row.path}:${row.name}`}
            onDoubleClick={() => onOpenItem(row)}
          >
            <td><span className="file-icon">{row.type === 'folder' ? '📁' : '▤'}</span>{row.name}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TransferBar({ transfers, isPending }: { transfers: TransferTask[]; isPending: boolean }) {
  return (
    <footer className="transfer-strip">
      <strong>{t.transferTasks}</strong>
      <span>{isPending ? '更新中...' : `${runningTransfers(transfers)} ${t.runningTasks}`}</span>
    </footer>
  )
}

function ConnectionModal({
  errorMessage,
  form,
  setForm,
  onSubmit,
  onClose
}: {
  errorMessage: string | null
  form: CreateProfileInput
  setForm(value: CreateProfileInput | ((prev: CreateProfileInput) => CreateProfileInput)): void
  onSubmit(event: FormEvent<HTMLFormElement>): void
  onClose(): void
}) {
  const [section, setSection] = useState<'ssh' | 'terminal' | 'proxy' | 'tunnel'>('ssh')

  return (
    <div className="modal-backdrop">
      <div className="modal-card ssh-modal">
        <div className="modal-header">
          <span>{t.newConnection}</span>
          <button className="icon-button" onClick={onClose} type="button">×</button>
        </div>
        <div className="ssh-modal-body">
          <aside className="ssh-modal-nav">
            <button className={section === 'ssh' ? 'active' : ''} type="button" onClick={() => setSection('ssh')}>SSH连接</button>
            <button className={section === 'terminal' ? 'active' : ''} type="button" onClick={() => setSection('terminal')}>终端</button>
            <button className={section === 'proxy' ? 'active' : ''} type="button" onClick={() => setSection('proxy')}>代理服务器</button>
            <button className={section === 'tunnel' ? 'active' : ''} type="button" onClick={() => setSection('tunnel')}>隧道</button>
          </aside>
          <form className="ssh-form-shell" onSubmit={onSubmit}>
            {section === 'ssh' ? (
              <div className="ssh-form-page">
                <fieldset className="ssh-fieldset">
                  <legend>常规</legend>
                  <div className="ssh-grid ssh-grid-general">
                    <label className="span-2">名称:<input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></label>
                    <label className="span-2">主机:<input value={form.host} onChange={(event) => setForm((prev) => ({ ...prev, host: event.target.value }))} /></label>
                    <label className="narrow">端口:<input min={1} type="number" value={form.port} onChange={(event) => setForm((prev) => ({ ...prev, port: Number(event.target.value) }))} /></label>
                    <label className="full">备注:<textarea value={form.note ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} /></label>
                  </div>
                </fieldset>
                <fieldset className="ssh-fieldset">
                  <legend>认证</legend>
                  <div className="ssh-grid ssh-grid-auth">
                    <label>方法:
                      <select value={form.authType} onChange={(event) => setForm((prev) => ({ ...prev, authType: event.target.value as 'password' | 'privateKey' }))}>
                        <option value="password">密码</option>
                        <option value="privateKey">私钥</option>
                      </select>
                    </label>
                    <label>用户名:<input value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} /></label>
                    <label className="span-2">密码:<input type="password" value={form.password ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} /></label>
                    <label className="full">私钥:<input value={form.privateKeyPath ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, privateKeyPath: event.target.value }))} /></label>
                  </div>
                </fieldset>
                <fieldset className="ssh-fieldset">
                  <legend>高级</legend>
                  <label className="ssh-checkbox">
                    <input checked={Boolean(form.enableExecChannel)} type="checkbox" onChange={(event) => setForm((prev) => ({ ...prev, enableExecChannel: event.target.checked }))} />
                    <span>启用Exec Channel(若连接上就被断开,请关闭该项,比如跳板机)</span>
                  </label>
                </fieldset>
              </div>
            ) : null}
            {section === 'terminal' ? (
              <div className="ssh-form-page">
                <fieldset className="ssh-fieldset narrow">
                  <legend>终端</legend>
                  <div className="ssh-grid single">
                    <label>字符编码:
                      <select value={form.encoding} onChange={(event) => setForm((prev) => ({ ...prev, encoding: event.target.value }))}>
                        <option value="UTF-8">UTF-8</option>
                        <option value="GBK">GBK</option>
                      </select>
                    </label>
                    <div className="terminal-key-box">
                      <strong>按键序列(解决退格/删除键失效,乱码问题):</strong>
                      <label>Backspace退格键
                        <select value={form.backspaceKey} onChange={(event) => setForm((prev) => ({ ...prev, backspaceKey: event.target.value }))}>
                          <option value="ASCII">ASCII - Backspace</option>
                          <option value="DEL">DEL - Backspace</option>
                        </select>
                      </label>
                      <label>Delete删除键
                        <select value={form.deleteKey} onChange={(event) => setForm((prev) => ({ ...prev, deleteKey: event.target.value }))}>
                          <option value="VT220">VT220 - Delete</option>
                          <option value="ASCII">ASCII - Delete</option>
                        </select>
                      </label>
                    </div>
                  </div>
                </fieldset>
              </div>
            ) : null}
            {section === 'proxy' ? <div className="ssh-placeholder">代理服务器功能稍后接入</div> : null}
            {section === 'tunnel' ? <div className="ssh-placeholder">隧道功能稍后接入</div> : null}
            {errorMessage ? <div className="modal-error">{errorMessage}</div> : null}
            <div className="form-actions ssh-actions">
              <button className="flat-button" onClick={onClose} type="button">{t.cancel}</button>
              <button className="primary-button" type="submit">{t.saveConnection}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function runningTransfers(transfers: TransferTask[]) {
  return transfers.filter((transfer) => transfer.status === 'running').length
}

function homeTabKey(id: string) {
  return `home:${id}`
}

function sessionTabKey(id: string) {
  return `session:${id}`
}

function insertAfterActive(keys: string[], activeKey: string | null, nextKey: string) {
  if (!activeKey) {
    return [...keys, nextKey]
  }

  const index = keys.indexOf(activeKey)
  if (index === -1) {
    return [...keys, nextKey]
  }

  const next = [...keys]
  next.splice(index + 1, 0, nextKey)
  return next
}

function reorderTabKeys(keys: string[], draggingKey: string | null, targetKey: string) {
  if (!draggingKey || draggingKey === targetKey) {
    return keys
  }

  const draggingIndex = keys.indexOf(draggingKey)
  const targetIndex = keys.indexOf(targetKey)
  if (draggingIndex === -1 || targetIndex === -1) {
    return keys
  }

  const next = [...keys]
  next.splice(draggingIndex, 1)
  next.splice(targetIndex, 0, draggingKey)
  return next
}

function tabStatusClass(status: WorkspaceTab['status']) {
  if (status === 'connected') {
    return 'connected'
  }
  if (status === 'error' || status === 'closed') {
    return 'disconnected'
  }
  if (status === 'connecting') {
    return 'connecting'
  }
  return 'idle'
}

function withParentRow(dirPath: string, items: LocalFileItem[]) {
  const parentPath = dirPath.includes('/') ? dirPath.split('/').slice(0, -1).join('/') || '/' : dirPath
  return dirPath === '/' ? items : [
    {
      path: parentPath,
      name: '..',
      type: 'folder' as const,
      modified: '',
      size: '-'
    },
    ...items
  ]
}
