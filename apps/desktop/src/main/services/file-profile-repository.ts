import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { ConnectionProfile, ConnectionFolder, CreateProfileInput } from '@termdock/core'
import type { ProfileRepository } from '@termdock/storage'

export class FileProfileRepository implements ProfileRepository {
  private readonly filePath: string
  private readonly foldersPath: string
  private readonly seedProfiles: ConnectionProfile[]
  private ready: Promise<void>

  constructor(baseDir: string, seedProfiles: ConnectionProfile[]) {
    this.filePath = path.join(baseDir, 'profiles.json')
    this.foldersPath = path.join(baseDir, 'folders.json')
    this.seedProfiles = seedProfiles
    this.ready = this.ensureFile()
  }

  async list(): Promise<ConnectionProfile[]> {
    const profiles = await this.readProfiles()
    return [...profiles]
  }

  async create(input: CreateProfileInput): Promise<ConnectionProfile> {
    const profiles = await this.readProfiles()
    const profile = toProfile(randomUUID(), input)

    const nextProfiles = [profile, ...profiles]
    await this.writeProfiles(nextProfiles)
    return profile
  }

  async update(id: string, input: CreateProfileInput): Promise<ConnectionProfile> {
    const profiles = await this.readProfiles()
    const profile = toProfile(id, input)
    const nextProfiles = profiles.map((item) => (item.id === id ? profile : item))
    await this.writeProfiles(nextProfiles)
    return profile
  }

  async getById(id: string): Promise<ConnectionProfile | null> {
    const profiles = await this.readProfiles()
    return profiles.find((profile) => profile.id === id) ?? null
  }

  async delete(id: string): Promise<void> {
    const profiles = await this.readProfiles()
    const nextProfiles = profiles.filter((profile) => profile.id !== id)
    await this.writeProfiles(nextProfiles)
  }

  async listFolders(): Promise<ConnectionFolder[]> {
    const folders = await this.readFolders()
    return [...folders]
  }

  async createFolder(name: string, parentId?: string): Promise<ConnectionFolder> {
    const folders = await this.readFolders()
    const folder: ConnectionFolder = {
      id: randomUUID(),
      type: 'folder',
      name,
      parentId,
      order: Date.now()
    }
    await this.writeFolders([folder, ...folders])
    return folder
  }

  async updateFolder(id: string, updates: Partial<ConnectionFolder>): Promise<ConnectionFolder> {
    const folders = await this.readFolders()
    let updatedFolder: ConnectionFolder | undefined
    const nextFolders = folders.map((f) => {
      if (f.id === id) {
        updatedFolder = { ...f, ...updates }
        return updatedFolder
      }
      return f
    })
    if (!updatedFolder) throw new Error('Folder not found')
    await this.writeFolders(nextFolders)
    return updatedFolder
  }

  async deleteFolder(id: string): Promise<void> {
    const folders = await this.readFolders()
    await this.writeFolders(folders.filter((f) => f.id !== id))
  }

  async updateOrder(id: string, newParentId: string | undefined, newOrder: number): Promise<void> {
    const profiles = await this.readProfiles()
    let found = false
    const nextProfiles = profiles.map((p) => {
      if (p.id === id) {
        found = true
        return { ...p, parentId: newParentId, order: newOrder }
      }
      return p
    })
    if (found) {
      await this.writeProfiles(nextProfiles)
      return
    }

    const folders = await this.readFolders()
    const nextFolders = folders.map((f) => {
      if (f.id === id) {
        return { ...f, parentId: newParentId, order: newOrder }
      }
      return f
    })
    await this.writeFolders(nextFolders)
  }

  private async ensureFile() {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    try {
      await readFile(this.filePath, 'utf8')
    } catch {
      await this.writeProfiles(this.seedProfiles)
    }
    try {
      await readFile(this.foldersPath, 'utf8')
    } catch {
      await this.writeFolders([])
    }
  }

  private async readProfiles(): Promise<ConnectionProfile[]> {
    await this.ready
    const content = await readFile(this.filePath, 'utf8')
    return JSON.parse(content) as ConnectionProfile[]
  }

  private async writeProfiles(profiles: ConnectionProfile[]) {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(profiles, null, 2), 'utf8')
  }

  private async readFolders(): Promise<ConnectionFolder[]> {
    await this.ready
    const content = await readFile(this.foldersPath, 'utf8')
    return JSON.parse(content) as ConnectionFolder[]
  }

  private async writeFolders(folders: ConnectionFolder[]) {
    await mkdir(path.dirname(this.foldersPath), { recursive: true })
    await writeFile(this.foldersPath, JSON.stringify(folders, null, 2), 'utf8')
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
