import { useEffect, useRef, useState, useTransition, type CSSProperties, type DragEvent, type FormEvent, type MouseEvent } from 'react'
import type {
  ConnectionProfile,
  CreateProfileInput,
  FileContentSnapshot,
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

const localFileDragType = 'application/x-termdock-local-file'
const remoteFileDragType = 'application/x-termdock-remote-file'

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
  tabs: [
    {
      id: 'preview-tab-ssh',
      sessionType: 'ssh',
      profileId: 'preview-profile-ssh',
      title: '123',
      layout: 'terminal-file',
      status: 'connected'
    }
  ],
  activeTabId: 'preview-tab-ssh',
  transfers: [],
  sessions: {
    'preview-tab-ssh': {
      profileId: 'preview-profile-ssh',
      summary: 'Connected to 192.168.3.197:22',
      terminalTranscript:
        'Linux fnOSNAS-CN 6.18.18-trim #473 SMP PREEMPT_DYNAMIC Thu Apr  9 09:34:02 UTC 2026 x86_64\r\nLast login: Fri May 15 21:57:26 2026 from 127.0.0.1\r\nCould not chdir to home directory /home/Stoffel: No such file or directory\r\nStoffel@fnOSNAS-CN:~$ ',
      remotePath: '/',
      remoteFiles: [
        { path: '/boot', name: 'boot', type: 'folder', modified: '2026-05-11 17:46', size: '-', permission: 'drwxr-xr-x', ownerGroup: '0/0' },
        { path: '/dev', name: 'dev', type: 'folder', modified: '2026-05-15 07:20', size: '-', permission: 'drwxr-xr-x', ownerGroup: '0/0' },
        { path: '/etc', name: 'etc', type: 'folder', modified: '2026-05-11 17:46', size: '-', permission: 'drwxr-xr-x', ownerGroup: '0/0' },
        { path: '/home', name: 'home', type: 'folder', modified: '2024-08-01 16:06', size: '-', permission: 'drwxr-xr-x', ownerGroup: '0/0' },
        { path: '/run', name: 'run', type: 'folder', modified: '2026-05-15 07:20', size: '-', permission: 'drwxr-xr-x', ownerGroup: '0/0' }
      ],
      connected: true,
      systemMetrics: {
        ip: '192.168.3.197',
        uptime: '4 天',
        load: '0.44, 0.66, 0.62',
        cpuPercent: 10,
        memoryPercent: 68,
        memoryUsage: '7.9G/11.6G',
        swapPercent: 7,
        swapUsage: '290M/4.0G',
        diskRows: [
          { path: '/dev', usage: '5.8G/5.8G' },
          { path: '/run', usage: '1.1G/1.2G' },
          { path: '/', usage: '44G/63G' },
          { path: '/dev/shm', usage: '5.9G/5.9G' },
          { path: '/run/lock', usage: '5.0M/5.0M' }
        ],
        networkInterfaces: ['enp3s0-ovs'],
        activeNetworkInterface: 'enp3s0-ovs',
        networkRates: { tx: '540B', rx: '233B' },
        networkSamples: Array.from({ length: 18 }, (_, index) => ({
          tx: [5, 11, 8, 14, 4, 9, 2, 12, 10, 6, 15, 7, 3, 8, 11, 4, 6, 9][index],
          rx: [10, 19, 13, 22, 6, 24, 8, 15, 18, 12, 20, 9, 5, 13, 16, 8, 11, 14][index]
        })),
        topProcesses: [
          { memory: '3171.4M', cpu: '3.0', command: 'python' },
          { memory: '1309.4M', cpu: '1.0', command: 'next-server' },
          { memory: '536.1M', cpu: '0.6', command: 'python3' },
          { memory: '349.7M', cpu: '0.5', command: 'trim-photos' }
        ]
      }
    }
  }
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

function profileToForm(profile: ConnectionProfile): CreateProfileInput {
  return {
    type: profile.type,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    username: profile.username,
    group: profile.group,
    remotePath: profile.remotePath,
    note: profile.note ?? '',
    password: profile.password ?? '',
    authType: profile.type === 'ssh' ? profile.authType : 'password',
    privateKeyPath: profile.type === 'ssh' ? profile.privateKeyPath ?? '' : '',
    passphrase: profile.type === 'ssh' ? profile.passphrase ?? '' : '',
    encoding: profile.type === 'ssh' ? profile.encoding ?? 'UTF-8' : 'UTF-8',
    backspaceKey: profile.type === 'ssh' ? profile.backspaceKey ?? 'ASCII' : 'ASCII',
    deleteKey: profile.type === 'ssh' ? profile.deleteKey ?? 'VT220' : 'VT220',
    enableExecChannel: profile.type === 'ssh' ? profile.enableExecChannel ?? true : true,
    secure: profile.type === 'ftp' ? profile.secure : false
  }
}

export function App() {
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>(emptyState)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [isBusy, setIsBusy] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showConnectionManager, setShowConnectionManager] = useState(false)
  const [form, setForm] = useState<CreateProfileInput>(defaultForm)
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null)
  const [localPath, setLocalPath] = useState(previewLocalPath)
  const [localItems, setLocalItems] = useState<LocalFileItem[]>(localPreviewFiles)
  const [homeTabs, setHomeTabs] = useState([{ id: 'home-1' }])
  const [activeHomeTabId, setActiveHomeTabId] = useState<string | null>('home-1')
  const [nextHomeTabNumber, setNextHomeTabNumber] = useState(2)
  const [tabOrder, setTabOrder] = useState<string[]>(['home:home-1'])
  const [draggingTabKey, setDraggingTabKey] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(214)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const [fileEditor, setFileEditor] = useState<FileContentSnapshot | null>(null)
  const [fileEditorError, setFileEditorError] = useState<string | null>(null)
  const [showTransfers, setShowTransfers] = useState(false)
  const homeTabsRef = useRef(homeTabs)
  const previousActiveTransferCountRef = useRef(0)
  const pendingHomeReplacementKeyRef = useRef<string | null>(null)
  const desktopApi = window.termdock
  const isDesktopRuntime = Boolean(desktopApi?.isDesktop)

  useEffect(() => {
    homeTabsRef.current = homeTabs
  }, [homeTabs])

  useEffect(() => {
    if (!desktopApi) {
      setWorkspace(previewState)
      setLocalPath(previewLocalPath)
      setLocalItems(localPreviewFiles)
      setActiveHomeTabId(null)
      setTabOrder(['session:preview-tab-ssh'])
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
  const activeTransferCount = workspace.transfers.filter((transfer) => transfer.status === 'running' || transfer.status === 'queued').length

  useEffect(() => {
    if (activeTransferCount > previousActiveTransferCountRef.current) {
      setShowTransfers(true)
    }
    previousActiveTransferCountRef.current = activeTransferCount
  }, [activeTransferCount])

  useEffect(() => {
    const allKeys = [
      ...homeTabs.map((tab) => homeTabKey(tab.id)),
      ...workspace.tabs.map((tab) => sessionTabKey(tab.id))
    ]

    setTabOrder((prev) => {
      const kept = prev.filter((key) => allKeys.includes(key))
      const missing = allKeys.filter((key) => !kept.includes(key))
      const replacementKey = pendingHomeReplacementKeyRef.current

      if (replacementKey && missing.length) {
        const replaceIndex = kept.indexOf(replacementKey)
        if (replaceIndex !== -1) {
          const next = [...kept]
          next.splice(replaceIndex, 1, missing[0])
          pendingHomeReplacementKeyRef.current = null
          return [...next, ...missing.slice(1)]
        }
      }

      return [...kept, ...missing]
    })
  }, [homeTabs, workspace.tabs])

  useEffect(() => {
    if (!isResizingSidebar) {
      return
    }

    const onMouseMove = (event: globalThis.MouseEvent) => {
      setSidebarWidth(Math.min(360, Math.max(190, event.clientX)))
    }

    const onMouseUp = () => {
      setIsResizingSidebar(false)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizingSidebar])

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

  const openCreateModal = () => {
    setEditingProfileId(null)
    setForm(defaultForm)
    setFormError(null)
    setShowForm(true)
  }

  const openEditModal = (profile: ConnectionProfile) => {
    setEditingProfileId(profile.id)
    setForm(profileToForm(profile))
    setFormError(null)
    setShowForm(true)
  }

  const handleSaveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.name || !form.host || !form.username || !form.group || !form.remotePath || !Number(form.port)) {
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
      setIsBusy(true)
      const payload = {
        ...form,
        port: Number(form.port)
      }
      const snapshot = editingProfileId
        ? await desktopApi.updateProfile(editingProfileId, payload)
        : await desktopApi.createProfile(payload)
      applySnapshot(snapshot)
      setShowForm(false)
      setEditingProfileId(null)
      setForm(defaultForm)
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleOpenProfile = async (profileId: string) => {
    if (!desktopApi) {
      return
    }

    const activeHomeId = activeHomeTabId
    const replacementKey = activeHomeId ? homeTabKey(activeHomeId) : null
    pendingHomeReplacementKeyRef.current = replacementKey

    try {
      setIsBusy(true)
      const snapshot = await desktopApi.openProfile(profileId)
      setWorkspace(snapshot)
      setError(null)
      setFormError(null)
      if (activeHomeId && snapshot.activeTabId && replacementKey) {
        const nextSessionKey = sessionTabKey(snapshot.activeTabId)
        setTabOrder((prev) => prev.map((key) => key === replacementKey ? nextSessionKey : key))
        setHomeTabs((prev) => prev.filter((tab) => tab.id !== activeHomeId))
        pendingHomeReplacementKeyRef.current = null
      }
      setActiveHomeTabId(null)
    } catch (err) {
      pendingHomeReplacementKeyRef.current = null
      setError((err as Error).message)
    } finally {
      setIsBusy(false)
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
      setIsBusy(true)
      const snapshot = await desktopApi.deleteProfile(profileId)
      applySnapshot(snapshot)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleActivateTab = async (tabId: string) => {
    if (!desktopApi) {
      return
    }

    try {
      setIsBusy(true)
      const snapshot = await desktopApi.activateTab(tabId)
      applySnapshot(snapshot)
      setActiveHomeTabId(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsBusy(false)
    }
  }

  const handleCloseTab = async (event: MouseEvent<HTMLButtonElement>, tabId: string) => {
    event.stopPropagation()
    if (!desktopApi) {
      return
    }

    try {
      setIsBusy(true)
      const snapshot = await desktopApi.closeTab(tabId)
      applySnapshot(snapshot)
      if (snapshot.activeTabId === null) {
        setHomeTabs((prev) => prev.length ? prev : [{ id: 'home-1' }])
        setTabOrder((prev) => {
          const filtered = prev.filter((key) => key !== sessionTabKey(tabId))
          return filtered.some((key) => key.startsWith('home:')) ? filtered : ['home:home-1', ...filtered]
        })
        setActiveHomeTabId((prev) => prev ?? homeTabsRef.current.at(-1)?.id ?? 'home-1')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsBusy(false)
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

    setHomeTabs((prev) => [...prev, { id: nextId }])
    setTabOrder((prev) => [...prev, nextKey])
    setNextHomeTabNumber((prev) => prev + 1)
    setActiveHomeTabId(nextId)
    setError(null)
  }

  const handleCloseHomeTab = (event: MouseEvent<HTMLButtonElement>, homeTabId: string) => {
    event.stopPropagation()

    setHomeTabs((prev) => {
      const remaining = prev.filter((tab) => tab.id !== homeTabId)

      if (remaining.length === 0 && workspace.tabs.length === 0) {
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

      setTabOrder((prev) => prev.filter((key) => key !== homeTabKey(homeTabId)))
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
    const localPaths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((filePath): filePath is string => Boolean(filePath))

    if (!localPaths.length || !desktopApi || !activeTab || !activeSession) {
      setError(t.desktopOnlyUpload)
      return
    }

    try {
      setIsBusy(true)
      for (const localFilePath of localPaths) {
        const snapshot = await desktopApi.uploadFile(activeTab.id, localFilePath, activeSession.remotePath)
        applySnapshot(snapshot)
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsBusy(false)
    }
  }

  const openLocalDirectory = async (targetPath: string) => {
    if (!desktopApi) {
      setLocalPath(targetPath)
      return
    }

    const { path, items } = await desktopApi.listLocalDirectory(targetPath)
    setLocalPath(path)
    setLocalItems(withParentRow(path, items))
  }

  const handleOpenLocalItem = async (item: LocalFileItem) => {
    if (!desktopApi) {
      setLocalPath(item.path)
      return
    }

    try {
      if (item.type === 'folder') {
        await openLocalDirectory(item.path)
        return
      }
      const content = await desktopApi.readLocalFile(item.path)
      setFileEditor({ path: item.path, name: item.name, source: 'local', content })
      setFileEditorError(null)
    } catch (err) {
      setError(item.type === 'folder' ? t.localLoadFailed : (err as Error).message)
    }
  }

  const openRemoteDirectory = async (tabId: string, targetPath: string) => {
    if (!desktopApi) {
      return
    }

    const snapshot = await desktopApi.openRemotePath(tabId, targetPath)
    applySnapshot(snapshot)
  }

  const openRemoteFileForEdit = async (tabId: string, item: RemoteFileItem) => {
    if (!desktopApi) {
      return
    }
    const content = await desktopApi.readRemoteFile(tabId, item.path)
    setFileEditor({ path: item.path, name: item.name, source: 'remote', content })
    setFileEditorError(null)
  }

  const handleSaveFileEditor = async (content: string) => {
    if (!desktopApi || !fileEditor) {
      return
    }

    try {
      setIsBusy(true)
      if (fileEditor.source === 'local') {
        await desktopApi.writeLocalFile(fileEditor.path, content)
        await openLocalDirectory(localPath)
      } else if (activeTab) {
        const snapshot = await desktopApi.writeRemoteFile(activeTab.id, fileEditor.path, content)
        applySnapshot(snapshot)
      }
      setFileEditor(null)
      setFileEditorError(null)
    } catch (err) {
      setFileEditorError((err as Error).message)
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <>
      <div className="fs-shell" style={{ '--sidebar-width': `${sidebarWidth}px` } as CSSProperties}>
        <header className="fs-tabbar">
          <div className="titlebar-brand">
            <strong>TermDock</strong>
          </div>
          <div className="titlebar-tabarea">
            <button
              aria-label="Open connection manager"
              className="tabbar-folder-button"
              onClick={() => setShowConnectionManager(true)}
              title="连接管理器"
              type="button"
            >
              <AppIcon name="connections" size={16} />
            </button>
            <div className="fs-tabs">
              {orderedTabs.map((entry, index) => (
                entry.kind === 'home' ? (
                  <div
                    key={entry.key}
                    className={`fs-tab home-tab ${activeHomeTabId === entry.id ? 'active' : ''}`}
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
                    className={`fs-tab session-tab ${entry.tab.id === workspace.activeTabId && !activeHomeTabId ? 'active' : ''}`}
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
              <button title="Grid" type="button"><AppIcon name="grid" /></button>
            </div>
          </div>
        </header>

        <aside className="fs-sidebar" style={{ position: 'relative' }}>
          <SystemPanel activeProfile={activeProfile} activeSession={activeSession} />
          <DiskPanel activeSession={activeSession} />
          <div
            aria-label="Resize sidebar"
            className={`sidebar-resizer ${isResizingSidebar ? 'is-active' : ''}`}
            onMouseDown={() => setIsResizingSidebar(true)}
            role="separator"
          />
        </aside>

        <main className={`fs-main ${error ? 'has-status' : 'no-status'}`}>
          {error ? <div className="status-message">{error}</div> : null}

          <div className="workspace-stage">
            {activeTab && activeSession ? (
              <SessionWorkspace
                activeTab={activeTab}
                activeSession={activeSession}
                localItems={localItems}
                localPath={localPath}
                onOpenLocalItem={handleOpenLocalItem}
                onOpenLocalPath={async (targetPath) => {
                  try {
                    await openLocalDirectory(targetPath)
                  } catch (err) {
                    setError((err as Error).message)
                  }
                }}
                onOpenRemoteItem={async (item) => {
                  if (!desktopApi) {
                    return
                  }

                  try {
                    setIsBusy(true)
                    if (item.type === 'folder') {
                      await openRemoteDirectory(activeTab.id, item.path)
                    } else {
                      await openRemoteFileForEdit(activeTab.id, item)
                    }
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setIsBusy(false)
                  }
                }}
                onOpenRemotePath={async (targetPath) => {
                  try {
                    setIsBusy(true)
                    await openRemoteDirectory(activeTab.id, targetPath)
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setIsBusy(false)
                  }
                }}
                onRefresh={async () => {
                  try {
                    setIsBusy(true)
                    await openLocalDirectory(localPath)
                    await openRemoteDirectory(activeTab.id, activeSession.remotePath)
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setIsBusy(false)
                  }
                }}
                onUploadFile={async (item) => {
                  if (!desktopApi) return
                  try {
                    setIsBusy(true)
                    const snapshot = await desktopApi.uploadFile(activeTab.id, item.path, activeSession.remotePath)
                    applySnapshot(snapshot)
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setIsBusy(false)
                  }
                }}
                onUploadFiles={async (items) => {
                  if (!desktopApi) return
                  try {
                    setIsBusy(true)
                    for (const item of items.filter((row) => row.type === 'file')) {
                      const snapshot = await desktopApi.uploadFile(activeTab.id, item.path, activeSession.remotePath)
                      applySnapshot(snapshot)
                    }
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setIsBusy(false)
                  }
                }}
                onChooseUploadFiles={async () => {
                  if (!desktopApi) return
                  const filePaths = await desktopApi.selectLocalFiles(localPath)
                  if (!filePaths.length) return
                  try {
                    setIsBusy(true)
                    for (const filePath of filePaths) {
                      const snapshot = await desktopApi.uploadFile(activeTab.id, filePath, activeSession.remotePath)
                      applySnapshot(snapshot)
                    }
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setIsBusy(false)
                  }
                }}
                onDownloadFiles={async (items, targetDirectory) => {
                  if (!desktopApi) return
                  const files = items.filter((row) => row.type === 'file')
                  if (!files.length) return
                  const downloadDirectory = targetDirectory ?? await desktopApi.selectLocalDirectory()
                  if (!downloadDirectory) return
                  try {
                    setIsBusy(true)
                    for (const item of files) {
                      const snapshot = await desktopApi.downloadFile(activeTab.id, item.path, downloadDirectory)
                      applySnapshot(snapshot)
                    }
                    await openLocalDirectory(downloadDirectory)
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setIsBusy(false)
                  }
                }}
                onDownloadFile={async (item, targetDirectory) => {
                  if (!desktopApi) return
                  const downloadDirectory = targetDirectory ?? await desktopApi.selectLocalDirectory()
                  if (!downloadDirectory) return
                  try {
                    setIsBusy(true)
                    const snapshot = await desktopApi.downloadFile(activeTab.id, item.path, downloadDirectory)
                    applySnapshot(snapshot)
                    await openLocalDirectory(downloadDirectory)
                  } catch (err) {
                    setError((err as Error).message)
                  } finally {
                    setIsBusy(false)
                  }
                }}
                onDropUpload={handleDropUpload}
              />
            ) : (
              <HomeWorkspace
                profiles={recentProfiles}
                isDesktopRuntime={isDesktopRuntime}
                onCreate={openCreateModal}
                onOpen={handleOpenProfile}
              />
            )}
          </div>
        </main>
        <TransferBar
          activeCount={activeTransferCount}
          isPending={isBusy}
          onOpen={() => setShowTransfers((prev) => !prev)}
          transfers={workspace.transfers}
        />
        {showTransfers ? (
          <TransferPopover
            transfers={workspace.transfers}
            onClose={() => setShowTransfers(false)}
          />
        ) : null}
      </div>

      {showConnectionManager ? (
        <ConnectionManagerModal
          profiles={workspace.profiles}
          onClose={() => setShowConnectionManager(false)}
          onCreate={() => {
            setShowConnectionManager(false)
            openCreateModal()
          }}
          onDelete={handleDeleteProfile}
          onEdit={(profile) => {
            setShowConnectionManager(false)
            openEditModal(profile)
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
          mode={editingProfileId ? 'edit' : 'create'}
          form={form}
          setForm={updateForm}
          onSubmit={handleSaveProfile}
          onClose={() => {
            setShowForm(false)
            setEditingProfileId(null)
            setFormError(null)
          }}
        />
      ) : null}
      {fileEditor ? (
        <FileEditorModal
          file={fileEditor}
          errorMessage={fileEditorError}
          onClose={() => {
            setFileEditor(null)
            setFileEditorError(null)
          }}
          onSave={handleSaveFileEditor}
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
  const internalIp = metrics?.ip || '-'
  const accessAddress = activeProfile?.host || activeSession?.accessHost || '-'

  return (
    <section className="sys-card">
      <div className="connection-summary">
        <AddressLine label={t.privateIp} value={internalIp} />
        <AddressLine label={t.accessAddress} value={accessAddress} />
      </div>
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

function AddressLine({ label, value }: { label: string; value: string }) {
  const canCopy = value && value !== '-'

  return (
    <div className="address-row">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
      <button
        className="copy-link"
        disabled={!canCopy}
        onClick={() => {
          if (canCopy) {
            copyText(value)
          }
        }}
        type="button"
      >
        复制
      </button>
    </div>
  )
}

function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
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
  onOpen
}: {
  profiles: ConnectionProfile[]
  isDesktopRuntime: boolean
  onCreate(): void
  onOpen(profileId: string): void
}) {
  return (
    <section className="home-workspace">
      <div className="quick-panel">
        <div className="quick-header">
          <strong>{t.quickConnect}</strong>
          <div>
            <button className="flat-button" type="button" disabled={!isDesktopRuntime} onClick={onCreate}>{t.newConnection}</button>
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
              <span className="host-icon"><AppIcon name="server" /></span>
              <strong>{profile.name}</strong>
              <span>{profile.note || '/'}</span>
              <span>{profile.username}</span>
              <small>{profile.type.toUpperCase()}</small>
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
  onDelete,
  onEdit,
  onOpen
}: {
  profiles: ConnectionProfile[]
  onClose(): void
  onCreate(): void
  onDelete(event: MouseEvent<HTMLButtonElement>, profileId: string): void
  onEdit(profile: ConnectionProfile): void
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
            <span>备注</span>
            <span>操作</span>
          </div>
          {profiles.map((profile) => (
            <div
              className="manager-row"
              key={profile.id}
              onDoubleClick={() => onOpen(profile.id)}
              onClick={() => onOpen(profile.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  onOpen(profile.id)
                }
              }}
              role="button"
              tabIndex={0}
            >
              <span>{profile.name}</span>
              <span>{profile.host}</span>
              <span>{profile.port}</span>
              <span>{profile.username}</span>
              <span>{profile.type.toUpperCase()}</span>
              <span>{profile.note || '/'}</span>
              <span className="manager-actions">
                <button
                  className="flat-button compact"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onEdit(profile)
                  }}
                >
                  编辑
                </button>
                <button
                  className="flat-button compact danger"
                  type="button"
                  onClick={(event) => onDelete(event, profile.id)}
                >
                  删除
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SessionWorkspace({
  activeTab,
  activeSession,
  localItems,
  localPath,
  onOpenLocalItem,
  onOpenLocalPath,
  onOpenRemoteItem,
  onOpenRemotePath,
  onRefresh,
  onUploadFile,
  onUploadFiles,
  onChooseUploadFiles,
  onDownloadFiles,
  onDownloadFile,
  onDropUpload
}: {
  activeTab: WorkspaceTab
  activeSession: SessionSnapshot
  localItems: LocalFileItem[]
  localPath: string
  onOpenLocalItem(item: LocalFileItem): void
  onOpenLocalPath(path: string): void
  onOpenRemoteItem(item: RemoteFileItem): void
  onOpenRemotePath(path: string): void
  onRefresh(): void
  onUploadFile(item: LocalFileItem): void
  onUploadFiles(items: LocalFileItem[]): void
  onChooseUploadFiles(): void
  onDownloadFiles(items: RemoteFileItem[], targetDirectory?: string): void
  onDownloadFile(item: RemoteFileItem, targetDirectory?: string): void
  onDropUpload(event: DragEvent<HTMLDivElement>): void
}) {
  const isFileOnly = activeTab.layout === 'file-only'
  const [filePanelHeight, setFilePanelHeight] = useState(218)
  const workspaceRef = useRef<HTMLElement | null>(null)
  const isResizingFilePanel = useRef(false)
  const hasAlignedFilePanel = useRef(false)

  useEffect(() => {
    if (isFileOnly) {
      return
    }

    const onMouseMove = (event: globalThis.MouseEvent) => {
      if (!isResizingFilePanel.current || !workspaceRef.current) {
        return
      }

      const rect = workspaceRef.current.getBoundingClientRect()
      const nextHeight = rect.bottom - event.clientY
      const maxHeight = Math.max(140, rect.height - 160)
      setFilePanelHeight(Math.min(maxHeight, Math.max(140, nextHeight)))
    }

    const onMouseUp = () => {
      isResizingFilePanel.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isFileOnly])

  useEffect(() => {
    hasAlignedFilePanel.current = false
  }, [activeTab.id])

  useEffect(() => {
    if (isFileOnly || hasAlignedFilePanel.current) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const workspaceRect = workspaceRef.current?.getBoundingClientRect()
      const diskHeadRect = document.querySelector('.disk-head')?.getBoundingClientRect()

      if (!workspaceRect || !diskHeadRect) {
        return
      }

      const nextHeight = workspaceRect.bottom - diskHeadRect.top
      const maxHeight = Math.max(140, workspaceRect.height - 160)

      if (nextHeight >= 140 && nextHeight <= maxHeight) {
        setFilePanelHeight(nextHeight)
        hasAlignedFilePanel.current = true
      }
    })

    return () => window.cancelAnimationFrame(frame)
  }, [isFileOnly, activeTab.id])

  return (
    <section
      className={`session-workspace ${isFileOnly ? 'file-only' : ''}`}
      ref={workspaceRef}
      style={{ '--file-panel-height': `${filePanelHeight}px` } as CSSProperties}
    >
      {!isFileOnly ? (
        <div className="terminal-area">
          <TerminalView
            tabId={activeTab.id}
            initialText={activeSession.terminalTranscript ?? ''}
          />
        </div>
      ) : null}
      {!isFileOnly ? (
        <div
          className="session-split-resizer"
          onMouseDown={() => {
            isResizingFilePanel.current = true
            document.body.style.cursor = 'row-resize'
            document.body.style.userSelect = 'none'
          }}
          role="separator"
        />
      ) : null}
      <FileManager
        activeSession={activeSession}
        localItems={localItems}
        localPath={localPath}
        onOpenLocalItem={onOpenLocalItem}
        onOpenLocalPath={onOpenLocalPath}
        onOpenRemoteItem={onOpenRemoteItem}
        onOpenRemotePath={onOpenRemotePath}
        onRefresh={onRefresh}
        onUploadFile={onUploadFile}
        onUploadFiles={onUploadFiles}
        onChooseUploadFiles={onChooseUploadFiles}
        onDownloadFiles={onDownloadFiles}
        onDownloadFile={onDownloadFile}
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
  onOpenLocalPath,
  onOpenRemoteItem,
  onOpenRemotePath,
  onRefresh,
  onUploadFile,
  onUploadFiles,
  onChooseUploadFiles,
  onDownloadFiles,
  onDownloadFile,
  onDropUpload
}: {
  activeSession: SessionSnapshot
  localItems: LocalFileItem[]
  localPath: string
  onOpenLocalItem(item: LocalFileItem): void
  onOpenLocalPath(path: string): void
  onOpenRemoteItem(item: RemoteFileItem): void
  onOpenRemotePath(path: string): void
  onRefresh(): void
  onUploadFile(item: LocalFileItem): void
  onUploadFiles(items: LocalFileItem[]): void
  onChooseUploadFiles(): void
  onDownloadFiles(items: RemoteFileItem[], targetDirectory?: string): void
  onDownloadFile(item: RemoteFileItem, targetDirectory?: string): void
  onDropUpload(event: DragEvent<HTMLDivElement>): void
}) {
  const [localPaneWidth, setLocalPaneWidth] = useState(230)
  const [localPathInput, setLocalPathInput] = useState(localPath)
  const [remotePathInput, setRemotePathInput] = useState(activeSession.remotePath)
  const [selectedLocalPaths, setSelectedLocalPaths] = useState<string[]>([])
  const [selectedRemotePaths, setSelectedRemotePaths] = useState<string[]>([])
  const [localAnchorPath, setLocalAnchorPath] = useState<string | null>(null)
  const [remoteAnchorPath, setRemoteAnchorPath] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    pane: 'local' | 'remote'
    x: number
    y: number
    path: string
  } | null>(null)
  const splitRef = useRef<HTMLDivElement | null>(null)
  const isResizingFileSplit = useRef(false)
  const isSelectingLocal = useRef(false)
  const isSelectingRemote = useRef(false)
  const didDragSelect = useRef(false)
  const suppressNextSelectionClick = useRef(false)
  const suppressNextClearClick = useRef(false)
  const localDragSelection = useRef<{ basePaths: string[]; startPath: string } | null>(null)
  const remoteDragSelection = useRef<{ basePaths: string[]; startPath: string } | null>(null)

  useEffect(() => {
    setLocalPathInput(localPath)
    setSelectedLocalPaths((prev) => prev.filter((selectedPath) => localItems.some((item) => item.path === selectedPath)))
  }, [localPath])

  useEffect(() => {
    setRemotePathInput(activeSession.remotePath)
    setSelectedRemotePaths((prev) => prev.filter((selectedPath) => activeSession.remoteFiles.some((item) => item.path === selectedPath)))
  }, [activeSession.remotePath])

  const selectedLocalItems = localItems.filter((item) => selectedLocalPaths.includes(item.path))
  const selectedRemoteItems = activeSession.remoteFiles.filter((item) => selectedRemotePaths.includes(item.path))
  const selectedRemoteFileItems = selectedRemoteItems.filter((item) => item.type === 'file')
  const contextLocalItem = contextMenu?.pane === 'local'
    ? localItems.find((item) => item.path === contextMenu.path) ?? null
    : null
  const contextRemoteItem = contextMenu?.pane === 'remote'
    ? activeSession.remoteFiles.find((item) => item.path === contextMenu.path) ?? null
    : null

  const submitLocalPath = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onOpenLocalPath(localPathInput.trim() || localPath)
  }

  const submitRemotePath = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const targetPath = remotePathInput.trim() || activeSession.remotePath
    onOpenRemotePath(targetPath)
  }

  const handleRemotePaneDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const draggedLocalPath = event.dataTransfer.getData(localFileDragType)
    if (draggedLocalPath) {
      const draggedPaths = parseDraggedPaths(draggedLocalPath)
      const items = localItems.filter((row) => draggedPaths.includes(row.path) && row.type === 'file')
      if (items.length) {
        onUploadFiles(items)
      }
      return
    }

    onDropUpload(event)
  }

  const handleLocalPaneDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const draggedRemotePayload = event.dataTransfer.getData(remoteFileDragType)
    if (!draggedRemotePayload) {
      return
    }

    const draggedPaths = parseDraggedPaths(draggedRemotePayload)
    const items = activeSession.remoteFiles.filter((row) => draggedPaths.includes(row.path) && row.type === 'file')
    if (items.length) {
      onDownloadFiles(items, localPath)
    }
  }

  const selectLocalItem = (event: MouseEvent<HTMLTableRowElement>, item: LocalFileItem) => {
    if (suppressNextSelectionClick.current) {
      suppressNextSelectionClick.current = false
      return
    }
    const selected = nextSelection({
      anchorPath: localAnchorPath,
      currentSelection: selectedLocalPaths,
      event,
      itemPath: item.path,
      rows: localItems
    })
    setSelectedLocalPaths(selected)
    setLocalAnchorPath(item.path)
  }

  const selectRemoteItem = (event: MouseEvent<HTMLTableRowElement>, item: RemoteFileItem) => {
    if (suppressNextSelectionClick.current) {
      suppressNextSelectionClick.current = false
      return
    }
    const selected = nextSelection({
      anchorPath: remoteAnchorPath,
      currentSelection: selectedRemotePaths,
      event,
      itemPath: item.path,
      rows: activeSession.remoteFiles
    })
    setSelectedRemotePaths(selected)
    setRemoteAnchorPath(item.path)
  }

  const extendLocalDragSelection = (item: LocalFileItem) => {
    const session = localDragSelection.current
    if (!isSelectingLocal.current || !session) return
    didDragSelect.current = true
    setSelectedLocalPaths(mergeUnique([
      ...session.basePaths,
      ...rangePaths(localItems, session.startPath, item.path)
    ]))
  }

  const extendRemoteDragSelection = (item: RemoteFileItem) => {
    const session = remoteDragSelection.current
    if (!isSelectingRemote.current || !session) return
    didDragSelect.current = true
    setSelectedRemotePaths(mergeUnique([
      ...session.basePaths,
      ...rangePaths(activeSession.remoteFiles, session.startPath, item.path)
    ]))
  }

  const openContextTarget = () => {
    if (contextLocalItem) {
      onOpenLocalItem(contextLocalItem)
    }
    if (contextRemoteItem) {
      onOpenRemoteItem(contextRemoteItem)
    }
    setContextMenu(null)
  }

  const copyContextPath = () => {
    const targetPath = contextLocalItem?.path ?? contextRemoteItem?.path
    if (targetPath) {
      copyText(targetPath)
    }
    setContextMenu(null)
  }

  useEffect(() => {
    const handleMouseMove = (event: globalThis.MouseEvent) => {
      if (!isResizingFileSplit.current || !splitRef.current) return

      const rect = splitRef.current.getBoundingClientRect()
      const minLocalWidth = 180
      const minRemoteWidth = 320
      const maxLocalWidth = Math.max(minLocalWidth, rect.width - minRemoteWidth)
      const nextWidth = Math.min(maxLocalWidth, Math.max(minLocalWidth, event.clientX - rect.left))
      setLocalPaneWidth(nextWidth)
    }

    const handleMouseUp = () => {
      if (didDragSelect.current) {
        suppressNextClearClick.current = true
      }
      didDragSelect.current = false
      isSelectingLocal.current = false
      isSelectingRemote.current = false
      localDragSelection.current = null
      remoteDragSelection.current = null
      if (!isResizingFileSplit.current) return
      isResizingFileSplit.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  return (
    <div className="file-manager" onClick={() => setContextMenu(null)}>
      <div className="file-tabs">
        <button className="active" type="button">{t.file}</button>
        <button type="button">{t.command}</button>
        <span className="file-current-path">{activeSession.remotePath}</span>
        <div className="file-tab-actions">
          <button title="刷新" type="button" onClick={onRefresh}><AppIcon name="refresh" /></button>
          <button
            title="下载到..."
            type="button"
            disabled={!selectedRemoteFileItems.length}
            onClick={() => onDownloadFiles(selectedRemoteFileItems)}
          >
            <AppIcon name="download" />
          </button>
          <button
            title={t.upload}
            type="button"
            onClick={onChooseUploadFiles}
          >
            <AppIcon name="upload" />
          </button>
        </div>
      </div>
      <div
        className="file-split"
        ref={splitRef}
        style={{ '--local-pane-width': `${localPaneWidth}px` } as CSSProperties}
      >
        <div
          className="local-pane"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedLocalPaths([])
              setLocalAnchorPath(null)
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={handleLocalPaneDrop}
        >
          <PanePathBar label={t.localComputer} value={localPathInput} onChange={setLocalPathInput} onSubmit={submitLocalPath} />
          <div
            className="file-table-shell"
            onClick={(event) => {
              if (event.target !== event.currentTarget) return
              if (suppressNextClearClick.current) {
                suppressNextClearClick.current = false
                return
              }
              setSelectedLocalPaths([])
              setLocalAnchorPath(null)
            }}
          >
            <LocalFileTable
              rows={localItems}
              selectedPaths={selectedLocalPaths}
              onDragItem={(event, item) => {
                event.dataTransfer.effectAllowed = 'copy'
                const payload = selectedLocalPaths.includes(item.path) ? selectedLocalPaths : [item.path]
                const previewItems = localItems.filter((row) => payload.includes(row.path))
                event.dataTransfer.setData(localFileDragType, JSON.stringify(payload))
                setFileDragPreview(event, previewItems.map((row) => row.name))
              }}
              onOpenItem={onOpenLocalItem}
              onContextItem={(event, item) => {
                event.preventDefault()
                event.stopPropagation()
                if (!selectedLocalPaths.includes(item.path)) {
                  setSelectedLocalPaths([item.path])
                  setLocalAnchorPath(item.path)
                }
                setContextMenu({ pane: 'local', x: event.clientX, y: event.clientY, path: item.path })
              }}
              onClearSelection={() => {
                if (suppressNextClearClick.current) {
                  suppressNextClearClick.current = false
                  return
                }
                setSelectedLocalPaths([])
                setLocalAnchorPath(null)
              }}
              onSelectItem={selectLocalItem}
              onSelectionDragStart={(event, item) => {
                isSelectingLocal.current = true
                didDragSelect.current = false
                const startPath = event.shiftKey && localAnchorPath ? localAnchorPath : item.path
                const basePaths = event.metaKey || event.ctrlKey ? selectedLocalPaths : []
                localDragSelection.current = { basePaths, startPath }
                suppressNextSelectionClick.current = true
                setSelectedLocalPaths(nextSelection({
                  anchorPath: localAnchorPath,
                  currentSelection: selectedLocalPaths,
                  event,
                  itemPath: item.path,
                  rows: localItems
                }))
                setLocalAnchorPath(startPath)
              }}
              onSelectionDragEnter={extendLocalDragSelection}
            />
          </div>
        </div>
        <div
          className="file-split-resizer"
          onMouseDown={() => {
            isResizingFileSplit.current = true
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
          role="separator"
        />
        <div
          className="remote-pane"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedRemotePaths([])
              setRemoteAnchorPath(null)
            }
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={handleRemotePaneDrop}
        >
          <PanePathBar
            hint={t.dragUpload}
            label={t.remoteHost}
            value={remotePathInput}
            onChange={setRemotePathInput}
            onSubmit={submitRemotePath}
          />
          <div
            className="file-table-shell"
            onClick={(event) => {
              if (event.target !== event.currentTarget) return
              if (suppressNextClearClick.current) {
                suppressNextClearClick.current = false
                return
              }
              setSelectedRemotePaths([])
              setRemoteAnchorPath(null)
            }}
          >
            <FileTable
              rows={activeSession.remoteFiles}
              selectedPaths={selectedRemotePaths}
              onDragItem={(event, item) => {
                event.dataTransfer.effectAllowed = 'copy'
                const payload = selectedRemotePaths.includes(item.path) ? selectedRemotePaths : [item.path]
                const previewItems = activeSession.remoteFiles.filter((row) => payload.includes(row.path))
                event.dataTransfer.setData(remoteFileDragType, JSON.stringify(payload))
                setFileDragPreview(event, previewItems.map((row) => row.name))
              }}
              onOpenItem={onOpenRemoteItem}
              onContextItem={(event, item) => {
                event.preventDefault()
                event.stopPropagation()
                if (!selectedRemotePaths.includes(item.path)) {
                  setSelectedRemotePaths([item.path])
                  setRemoteAnchorPath(item.path)
                }
                setContextMenu({ pane: 'remote', x: event.clientX, y: event.clientY, path: item.path })
              }}
              onClearSelection={() => {
                if (suppressNextClearClick.current) {
                  suppressNextClearClick.current = false
                  return
                }
                setSelectedRemotePaths([])
                setRemoteAnchorPath(null)
              }}
              onSelectItem={selectRemoteItem}
              onSelectionDragStart={(event, item) => {
                isSelectingRemote.current = true
                didDragSelect.current = false
                const startPath = event.shiftKey && remoteAnchorPath ? remoteAnchorPath : item.path
                const basePaths = event.metaKey || event.ctrlKey ? selectedRemotePaths : []
                remoteDragSelection.current = { basePaths, startPath }
                suppressNextSelectionClick.current = true
                setSelectedRemotePaths(nextSelection({
                  anchorPath: remoteAnchorPath,
                  currentSelection: selectedRemotePaths,
                  event,
                  itemPath: item.path,
                  rows: activeSession.remoteFiles
                }))
                setRemoteAnchorPath(startPath)
              }}
              onSelectionDragEnter={extendRemoteDragSelection}
            />
          </div>
        </div>
      </div>
      {contextMenu ? (
        <FileContextMenu
          item={contextLocalItem ?? contextRemoteItem}
          pane={contextMenu.pane}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          onClose={() => setContextMenu(null)}
          onCopyPath={copyContextPath}
          onDownload={() => {
            const items = contextRemoteItem && selectedRemotePaths.includes(contextRemoteItem.path)
              ? selectedRemoteItems
              : contextRemoteItem ? [contextRemoteItem] : []
            onDownloadFiles(items)
            setContextMenu(null)
          }}
          onOpen={openContextTarget}
          onRefresh={() => {
            onRefresh()
            setContextMenu(null)
          }}
          onUpload={() => {
            onChooseUploadFiles()
            setContextMenu(null)
          }}
        />
      ) : null}
    </div>
  )
}

function PanePathBar({
  hint,
  label,
  value,
  onChange,
  onSubmit
}: {
  hint?: string
  label: string
  value: string
  onChange(value: string): void
  onSubmit(event: FormEvent<HTMLFormElement>): void
}) {
  return (
    <form className="pane-path-bar" onSubmit={onSubmit}>
      <strong>{label}</strong>
      <input
        aria-label={`${label}路径`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <span>{hint}</span> : null}
    </form>
  )
}

function FileTable({
  rows,
  compact = false,
  selectedPaths,
  onClearSelection,
  onContextItem,
  onDragItem,
  onOpenItem,
  onSelectItem,
  onSelectionDragEnter,
  onSelectionDragStart
}: {
  rows: RemoteFileItem[]
  compact?: boolean
  selectedPaths?: string[]
  onClearSelection?(): void
  onContextItem?(event: MouseEvent<HTMLTableRowElement>, item: RemoteFileItem): void
  onDragItem?(event: DragEvent<HTMLElement>, item: RemoteFileItem): void
  onOpenItem?(item: RemoteFileItem): void
  onSelectItem?(event: MouseEvent<HTMLTableRowElement>, item: RemoteFileItem): void
  onSelectionDragEnter?(item: RemoteFileItem): void
  onSelectionDragStart?(event: MouseEvent<HTMLTableRowElement>, item: RemoteFileItem): void
}) {
  return (
    <table
      className={`fs-file-table ${compact ? 'compact' : ''}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClearSelection?.()
        }
      }}
    >
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
      <tbody onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClearSelection?.()
        }
      }}>
        {rows.length ? rows.map((row) => (
          <tr
            key={row.path}
            className={`${row.type === 'folder' ? 'is-folder' : 'is-file'} ${selectedPaths?.includes(row.path) ? 'is-selected' : ''}`}
            onClick={(event) => onSelectItem?.(event, row)}
            onContextMenu={(event) => onContextItem?.(event, row)}
            onDoubleClick={() => onOpenItem?.(row)}
            onMouseDown={(event) => {
              if (event.button === 0) {
                onSelectionDragStart?.(event, row)
              }
            }}
            onMouseEnter={() => onSelectionDragEnter?.(row)}
          >
            <td>
              <span
                className={`file-icon ${row.type === 'file' ? 'is-draggable' : ''}`}
                draggable={row.type === 'file'}
                onDragStart={(event) => onDragItem?.(event, row)}
                onMouseDown={(event) => event.stopPropagation()}
                title={row.type === 'file' ? '拖动传输' : undefined}
              >
                <AppIcon name={row.type === 'folder' ? 'folder' : 'file'} />
              </span>
              {row.name}
            </td>
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
  selectedPaths,
  onClearSelection,
  onContextItem,
  onDragItem,
  onOpenItem,
  onSelectItem,
  onSelectionDragEnter,
  onSelectionDragStart
}: {
  rows: LocalFileItem[]
  selectedPaths: string[]
  onClearSelection(): void
  onContextItem(event: MouseEvent<HTMLTableRowElement>, item: LocalFileItem): void
  onDragItem(event: DragEvent<HTMLElement>, item: LocalFileItem): void
  onOpenItem(item: LocalFileItem): void
  onSelectItem(event: MouseEvent<HTMLTableRowElement>, item: LocalFileItem): void
  onSelectionDragEnter(item: LocalFileItem): void
  onSelectionDragStart(event: MouseEvent<HTMLTableRowElement>, item: LocalFileItem): void
}) {
  return (
    <table
      className="fs-file-table compact"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClearSelection()
        }
      }}
    >
      <thead>
        <tr>
          <th>{t.fileName}</th>
        </tr>
      </thead>
      <tbody onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClearSelection()
        }
      }}>
        {rows.map((row) => (
          <tr
            key={`${row.path}:${row.name}`}
            className={`${row.type === 'folder' ? 'is-folder' : 'is-file'} ${selectedPaths.includes(row.path) ? 'is-selected' : ''}`}
            onClick={(event) => onSelectItem(event, row)}
            onContextMenu={(event) => onContextItem(event, row)}
            onDoubleClick={() => onOpenItem(row)}
            onMouseDown={(event) => {
              if (event.button === 0) {
                onSelectionDragStart(event, row)
              }
            }}
            onMouseEnter={() => onSelectionDragEnter(row)}
          >
            <td>
              <span
                className={`file-icon ${row.type === 'file' ? 'is-draggable' : ''}`}
                draggable={row.type === 'file'}
                onDragStart={(event) => onDragItem(event, row)}
                onMouseDown={(event) => event.stopPropagation()}
                title={row.type === 'file' ? '拖动传输' : undefined}
              >
                <AppIcon name={row.type === 'folder' ? 'folder' : 'file'} />
              </span>
              {row.name}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function FileContextMenu({
  item,
  onClose,
  onCopyPath,
  onDownload,
  onOpen,
  onRefresh,
  onUpload,
  pane,
  position
}: {
  item: LocalFileItem | RemoteFileItem | null
  onClose(): void
  onCopyPath(): void
  onDownload(): void
  onOpen(): void
  onRefresh(): void
  onUpload(): void
  pane: 'local' | 'remote'
  position: { x: number; y: number }
}) {
  const canDownload = pane === 'remote' && item?.type === 'file'
  const canUpload = pane === 'remote'

  return (
    <div
      className="file-context-menu"
      onClick={(event) => event.stopPropagation()}
      style={{ left: position.x, top: position.y } as CSSProperties}
    >
      <button type="button" onClick={onRefresh}>刷新</button>
      <span />
      <button type="button" disabled={!item} onClick={onOpen}>打开</button>
      <button type="button" disabled>打开方式</button>
      <button type="button" disabled>选择文本编辑器</button>
      <span />
      <button type="button" disabled={!item} onClick={onCopyPath}>复制路径</button>
      <span />
      <button type="button" disabled={!canDownload} onClick={onDownload}>下载</button>
      <button type="button" disabled={!canUpload} onClick={onUpload}>上传...</button>
      <span />
      <button type="button" disabled>打包传输</button>
      <span />
      <button type="button" disabled>新建</button>
      <span />
      <button type="button" disabled>重命名</button>
      <button type="button" disabled>删除</button>
      <button type="button" disabled>快速删除 (rm命令)</button>
      <span />
      <button type="button" disabled>文件权限...</button>
      <button className="context-close" type="button" onClick={onClose}>关闭</button>
    </div>
  )
}

function FileEditorModal({
  errorMessage,
  file,
  onClose,
  onSave
}: {
  errorMessage: string | null
  file: FileContentSnapshot
  onClose(): void
  onSave(content: string): void
}) {
  const [content, setContent] = useState(file.content)

  useEffect(() => {
    setContent(file.content)
  }, [file.content, file.path])

  return (
    <div className="modal-backdrop">
      <div className="modal-card file-editor-modal">
        <div className="modal-header">
          <span>{file.source === 'remote' ? '编辑远程文件' : '编辑本地文件'} · {file.name}</span>
          <button className="icon-button" onClick={onClose} type="button">×</button>
        </div>
        <div className="file-editor-path" title={file.path}>{file.path}</div>
        <textarea
          className="file-editor-textarea"
          spellCheck={false}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
        {errorMessage ? <div className="modal-error">{errorMessage}</div> : null}
        <div className="form-actions">
          <button className="flat-button" onClick={onClose} type="button">{t.cancel}</button>
          <button className="primary-button" onClick={() => onSave(content)} type="button">保存</button>
        </div>
      </div>
    </div>
  )
}

function TransferBar({
  activeCount,
  isPending,
  onOpen,
  transfers
}: {
  activeCount: number
  isPending: boolean
  onOpen(): void
  transfers: TransferTask[]
}) {
  return (
    <footer className="transfer-strip">
      <strong>{t.transferTasks}</strong>
      <button className="transfer-summary-button" onClick={onOpen} type="button">
        {isPending ? '更新中...' : `${activeCount || runningTransfers(transfers)} ${t.runningTasks}`}
      </button>
    </footer>
  )
}

function TransferPopover({
  onClose,
  transfers
}: {
  onClose(): void
  transfers: TransferTask[]
}) {
  const [statusFilter, setStatusFilter] = useState<'running' | 'completed' | 'all'>('running')
  const [directionFilter, setDirectionFilter] = useState<'all' | 'download' | 'upload'>('all')
  const visibleTransfers = transfers
    .filter((transfer) => {
      if (statusFilter === 'running') {
        return transfer.status === 'running' || transfer.status === 'queued'
      }
      if (statusFilter === 'completed') {
        return transfer.status === 'done' || transfer.status === 'failed'
      }
      return true
    })
    .filter((transfer) => directionFilter === 'all' || transfer.direction === directionFilter)
    .slice(0, 24)

  return (
    <section className="transfer-popover">
      <div className="transfer-popover-head">
        <strong>传输详情</strong>
        <button className="icon-button" onClick={onClose} type="button">×</button>
      </div>
      <div className="transfer-filters">
        <div className="transfer-segments">
          <button
            className={statusFilter === 'running' ? 'active' : ''}
            onClick={() => setStatusFilter('running')}
            type="button"
          >
            进行中
          </button>
          <button
            className={statusFilter === 'completed' ? 'active' : ''}
            onClick={() => setStatusFilter('completed')}
            type="button"
          >
            已完成
          </button>
          <button
            className={statusFilter === 'all' ? 'active' : ''}
            onClick={() => setStatusFilter('all')}
            type="button"
          >
            全部
          </button>
        </div>
        <div className="transfer-segments transfer-segments-sub">
          <button
            className={directionFilter === 'all' ? 'active' : ''}
            onClick={() => setDirectionFilter('all')}
            type="button"
          >
            全部
          </button>
          <button
            className={directionFilter === 'download' ? 'active' : ''}
            onClick={() => setDirectionFilter('download')}
            type="button"
          >
            下载
          </button>
          <button
            className={directionFilter === 'upload' ? 'active' : ''}
            onClick={() => setDirectionFilter('upload')}
            type="button"
          >
            上传
          </button>
        </div>
      </div>
      <div className="transfer-popover-list">
        {visibleTransfers.length ? visibleTransfers.map((transfer) => (
          <div className={`transfer-row transfer-${transfer.status}`} key={transfer.id}>
            <div className="transfer-row-main">
              <strong title={transfer.name}>{transfer.name}</strong>
              <span>{transferStatusText(transfer)}</span>
            </div>
            <div className="transfer-row-meta">
              <span>{transfer.direction === 'upload' ? '上传' : '下载'}</span>
              <b>{transfer.progress}%</b>
            </div>
            <i className="transfer-progress"><b style={{ width: `${transfer.progress}%` }} /></i>
            {transfer.message ? <small title={transfer.message}>{transfer.message}</small> : null}
          </div>
        )) : (
          <div className="transfer-empty">暂无传输任务</div>
        )}
      </div>
    </section>
  )
}

function AppIcon({
  name,
  size = 14
}: {
  name: 'grid' | 'menu' | 'server' | 'connections' | 'folder' | 'file' | 'history' | 'refresh' | 'upload' | 'download'
  size?: number
}) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8
  }

  return (
    <svg aria-hidden="true" className={`app-icon app-icon-${name}`} height={size} viewBox="0 0 16 16" width={size}>
      {name === 'grid' ? (
        <>
          <rect {...commonProps} x="2.25" y="2.25" width="4.5" height="4.5" />
          <rect {...commonProps} x="9.25" y="2.25" width="4.5" height="4.5" />
          <rect {...commonProps} x="2.25" y="9.25" width="4.5" height="4.5" />
          <rect {...commonProps} x="9.25" y="9.25" width="4.5" height="4.5" />
        </>
      ) : null}
      {name === 'menu' ? (
        <>
          <path {...commonProps} d="M3 4.5h10" />
          <path {...commonProps} d="M3 8h10" />
          <path {...commonProps} d="M3 11.5h10" />
        </>
      ) : null}
      {name === 'server' ? (
        <>
          <rect {...commonProps} x="2.5" y="2.5" width="11" height="4" rx="1.2" />
          <rect {...commonProps} x="2.5" y="9.5" width="11" height="4" rx="1.2" />
          <path {...commonProps} d="M4.5 4.5h.01M4.5 11.5h.01" />
          <path {...commonProps} d="M8 6.5v3" />
        </>
      ) : null}
      {name === 'connections' ? (
        <>
          <rect {...commonProps} x="2.8" y="3" width="4.2" height="4.2" rx="1" />
          <rect {...commonProps} x="9" y="3" width="4.2" height="4.2" rx="1" />
          <rect {...commonProps} x="5.9" y="9" width="4.2" height="4.2" rx="1" />
          <path {...commonProps} d="M7 5.1h2" />
          <path {...commonProps} d="M5.2 7.2 6.8 9" />
          <path {...commonProps} d="M10.8 7.2 9.2 9" />
        </>
      ) : null}
      {name === 'folder' ? (
        <path {...commonProps} d="M2.5 4.5h3l1.4 1.6h6.6v5.8a1.1 1.1 0 0 1-1.1 1.1H3.6a1.1 1.1 0 0 1-1.1-1.1V5.6a1.1 1.1 0 0 1 1.1-1.1Z" />
      ) : null}
      {name === 'file' ? (
        <>
          <path {...commonProps} d="M5 2.5h4.5L13 6v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9.5a1 1 0 0 1 1-1Z" />
          <path {...commonProps} d="M9.5 2.5V6H13" />
        </>
      ) : null}
      {name === 'history' ? (
        <>
          <path {...commonProps} d="M3.2 8a4.8 4.8 0 1 0 1.4-3.4" />
          <path {...commonProps} d="M3 3.5v2.8h2.8" />
        </>
      ) : null}
      {name === 'refresh' ? (
        <>
          <path {...commonProps} d="M12.8 6A4.9 4.9 0 0 0 4.4 4.2" />
          <path {...commonProps} d="M4.2 2.9v2.8H7" />
          <path {...commonProps} d="M3.2 10A4.9 4.9 0 0 0 11.6 11.8" />
          <path {...commonProps} d="M11.8 13.1v-2.8H9" />
        </>
      ) : null}
      {name === 'download' ? (
        <>
          <path {...commonProps} d="M8 3.5v7.3" />
          <path {...commonProps} d="M4.7 7.5 8 10.8l3.3-3.3" />
          <path {...commonProps} d="M3 12.5h10" />
        </>
      ) : null}
      {name === 'upload' ? (
        <>
          <path {...commonProps} d="M8 10.8V3.5" />
          <path {...commonProps} d="M4.7 6.8 8 3.5l3.3 3.3" />
          <path {...commonProps} d="M3 12.5h10" />
        </>
      ) : null}
    </svg>
  )
}

function ConnectionModal({
  errorMessage,
  mode,
  form,
  setForm,
  onSubmit,
  onClose
}: {
  errorMessage: string | null
  mode: 'create' | 'edit'
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
          <span>{mode === 'edit' ? '编辑连接' : t.newConnection}</span>
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
                    <label>类型:
                      <select
                        value={form.type}
                        onChange={(event) => {
                          const nextType = event.target.value as 'ssh' | 'ftp'
                          setForm((prev) => ({
                            ...prev,
                            type: nextType,
                            port: nextType === 'ftp' && prev.port === 22 ? 21 : nextType === 'ssh' && prev.port === 21 ? 22 : prev.port,
                            authType: nextType === 'ssh' ? prev.authType ?? 'password' : 'password'
                          }))
                        }}
                      >
                        <option value="ssh">SSH / SFTP</option>
                        <option value="ftp">FTP / FTPS</option>
                      </select>
                    </label>
                    <label>分组:<input value={form.group} onChange={(event) => setForm((prev) => ({ ...prev, group: event.target.value }))} /></label>
                    <label className="span-2">名称:<input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} /></label>
                    <label className="span-2">主机:<input value={form.host} onChange={(event) => setForm((prev) => ({ ...prev, host: event.target.value }))} /></label>
                    <label className="narrow">端口:<input inputMode="numeric" value={form.port || ''} onChange={(event) => setForm((prev) => ({ ...prev, port: Number(event.target.value.replace(/\D/g, '')) }))} /></label>
                    <label>远程路径:<input value={form.remotePath} onChange={(event) => setForm((prev) => ({ ...prev, remotePath: event.target.value }))} /></label>
                    <label className="full">备注:<textarea value={form.note ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} /></label>
                  </div>
                </fieldset>
                <fieldset className="ssh-fieldset">
                  <legend>认证</legend>
                  <div className="ssh-grid ssh-grid-auth">
                    {form.type === 'ssh' ? (
                      <label>方法:
                        <select value={form.authType} onChange={(event) => setForm((prev) => ({ ...prev, authType: event.target.value as 'password' | 'privateKey' }))}>
                          <option value="password">密码</option>
                          <option value="privateKey">私钥</option>
                        </select>
                      </label>
                    ) : null}
                    <label>用户名:<input value={form.username} onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))} /></label>
                    <label className="span-2">密码:<input type="password" value={form.password ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} /></label>
                    {form.type === 'ssh' ? (
                      <label className="full">私钥:<input value={form.privateKeyPath ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, privateKeyPath: event.target.value }))} /></label>
                    ) : (
                      <label className="ssh-checkbox span-2">
                        <input checked={Boolean(form.secure)} type="checkbox" onChange={(event) => setForm((prev) => ({ ...prev, secure: event.target.checked }))} />
                        <span>使用 FTPS</span>
                      </label>
                    )}
                  </div>
                </fieldset>
                {form.type === 'ssh' ? <fieldset className="ssh-fieldset">
                  <legend>高级</legend>
                  <label className="ssh-checkbox">
                    <input checked={Boolean(form.enableExecChannel)} type="checkbox" onChange={(event) => setForm((prev) => ({ ...prev, enableExecChannel: event.target.checked }))} />
                    <span>启用Exec Channel(若连接上就被断开,请关闭该项,比如跳板机)</span>
                  </label>
                </fieldset> : null}
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
              <button className="primary-button" type="submit">{mode === 'edit' ? '保存修改' : t.saveConnection}</button>
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

function nextSelection<T extends { path: string }>({
  anchorPath,
  currentSelection,
  event,
  itemPath,
  rows
}: {
  anchorPath: string | null
  currentSelection: string[]
  event: MouseEvent<HTMLTableRowElement>
  itemPath: string
  rows: T[]
}) {
  if (event.shiftKey && anchorPath) {
    const anchorIndex = rows.findIndex((row) => row.path === anchorPath)
    const itemIndex = rows.findIndex((row) => row.path === itemPath)
    if (anchorIndex !== -1 && itemIndex !== -1) {
      const start = Math.min(anchorIndex, itemIndex)
      const end = Math.max(anchorIndex, itemIndex)
      return rows.slice(start, end + 1).map((row) => row.path)
    }
  }

  if (event.metaKey || event.ctrlKey) {
    return currentSelection.includes(itemPath)
      ? currentSelection.filter((selectedPath) => selectedPath !== itemPath)
      : [...currentSelection, itemPath]
  }

  return [itemPath]
}

function rangePaths<T extends { path: string }>(rows: T[], startPath: string, endPath: string) {
  const startIndex = rows.findIndex((row) => row.path === startPath)
  const endIndex = rows.findIndex((row) => row.path === endPath)
  if (startIndex === -1 || endIndex === -1) {
    return endPath ? [endPath] : []
  }
  const start = Math.min(startIndex, endIndex)
  const end = Math.max(startIndex, endIndex)
  return rows.slice(start, end + 1).map((row) => row.path)
}

function mergeUnique(values: string[]) {
  return Array.from(new Set(values))
}

function parseDraggedPaths(payload: string) {
  try {
    const parsed = JSON.parse(payload)
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [payload]
  } catch {
    return [payload]
  }
}

function setFileDragPreview(event: DragEvent<HTMLElement>, names: string[]) {
  if (!names.length) {
    return
  }

  const preview = document.createElement('div')
  preview.className = 'file-drag-preview'
  const visibleNames = names.slice(0, 2)
  preview.innerHTML = `
    <span class="file-drag-preview-icon">□</span>
    <span>${escapeHtml(visibleNames.join(names.length > 1 ? ', ' : ''))}${names.length > 2 ? ` 等 ${names.length} 项` : ''}</span>
  `
  document.body.appendChild(preview)
  event.dataTransfer.setDragImage(preview, 10, 10)
  window.setTimeout(() => preview.remove(), 0)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function transferStatusText(transfer: TransferTask) {
  const direction = transfer.direction === 'upload' ? '上传' : '下载'
  if (transfer.status === 'failed') {
    return `${direction}失败: ${transfer.name}`
  }
  if (transfer.status === 'done') {
    return `${direction}完成: ${transfer.name}`
  }
  if (transfer.status === 'queued') {
    return `等待${direction}: ${transfer.name}`
  }
  return `${direction}中 ${transfer.progress}%: ${transfer.name}`
}
