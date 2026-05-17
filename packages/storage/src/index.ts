import type { ConnectionProfile, ConnectionFolder, CreateProfileInput } from '@termdock/core'

export interface ProfileRepository {
  list(): Promise<ConnectionProfile[]>
  listFolders(): Promise<ConnectionFolder[]>
  create(input: CreateProfileInput): Promise<ConnectionProfile>
  update(id: string, input: CreateProfileInput): Promise<ConnectionProfile>
  getById(id: string): Promise<ConnectionProfile | null>
  delete(id: string): Promise<void>
  
  createFolder(name: string, parentId?: string): Promise<ConnectionFolder>
  updateFolder(id: string, updates: Partial<ConnectionFolder>): Promise<ConnectionFolder>
  deleteFolder(id: string): Promise<void>
  
  updateOrder(id: string, newParentId: string | undefined, newOrder: number): Promise<void>
}

export class MemoryProfileRepository implements ProfileRepository {
  private profiles: ConnectionProfile[]
  private folders: ConnectionFolder[] = []

  constructor(seed: ConnectionProfile[]) {
    this.profiles = seed
  }

  async list(): Promise<ConnectionProfile[]> {
    return [...this.profiles]
  }

  async create(input: CreateProfileInput): Promise<ConnectionProfile> {
    const id = globalThis.crypto?.randomUUID?.() ?? `profile-${Date.now()}`
    const profile = toProfile(id, input)

    this.profiles = [profile, ...this.profiles]
    return profile
  }

  async update(id: string, input: CreateProfileInput): Promise<ConnectionProfile> {
    const profile = toProfile(id, input)
    this.profiles = this.profiles.map((item) => (item.id === id ? profile : item))
    return profile
  }

  async getById(id: string): Promise<ConnectionProfile | null> {
    return this.profiles.find((profile) => profile.id === id) ?? null
  }

  async delete(id: string): Promise<void> {
    this.profiles = this.profiles.filter((profile) => profile.id !== id)
  }

  async listFolders(): Promise<ConnectionFolder[]> {
    return [...this.folders]
  }

  async createFolder(name: string, parentId?: string): Promise<ConnectionFolder> {
    const id = globalThis.crypto?.randomUUID?.() ?? `folder-${Date.now()}`
    const folder: ConnectionFolder = { id, type: 'folder', name, parentId }
    this.folders.push(folder)
    return folder
  }

  async updateFolder(id: string, updates: Partial<ConnectionFolder>): Promise<ConnectionFolder> {
    const folder = this.folders.find((f) => f.id === id)
    if (!folder) throw new Error('Folder not found')
    Object.assign(folder, updates)
    return folder
  }

  async deleteFolder(id: string): Promise<void> {
    this.folders = this.folders.filter((f) => f.id !== id)
  }

  async updateOrder(id: string, newParentId: string | undefined, newOrder: number): Promise<void> {
    const profile = this.profiles.find((p) => p.id === id)
    if (profile) {
      profile.parentId = newParentId
      profile.order = newOrder
      return
    }
    const folder = this.folders.find((f) => f.id === id)
    if (folder) {
      folder.parentId = newParentId
      folder.order = newOrder
    }
  }
}

function toProfile(id: string, input: CreateProfileInput): ConnectionProfile {
  return input.type === 'ssh'
    ? {
        id,
        type: 'ssh',
        name: input.name,
        host: input.host,
        port: input.port,
        username: input.username,
        authType: input.authType ?? 'password',
        note: input.note,
        password: input.password,
        privateKeyPath: input.privateKeyPath,
        passphrase: input.passphrase,
        group: input.group,
        sftpEnabled: true,
        remotePath: input.remotePath,
        encoding: input.encoding ?? 'UTF-8',
        backspaceKey: input.backspaceKey ?? 'ASCII',
        deleteKey: input.deleteKey ?? 'VT220',
        enableExecChannel: input.enableExecChannel ?? true
      }
    : {
        id,
        type: 'ftp',
        name: input.name,
        host: input.host,
        port: input.port,
        username: input.username,
        note: input.note,
        password: input.password,
        secure: input.secure ?? false,
        group: input.group,
        remotePath: input.remotePath
      }
}
