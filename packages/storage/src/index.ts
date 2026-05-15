import type { ConnectionProfile, CreateProfileInput } from '@termdock/core'

export interface ProfileRepository {
  list(): Promise<ConnectionProfile[]>
  create(input: CreateProfileInput): Promise<ConnectionProfile>
  getById(id: string): Promise<ConnectionProfile | null>
  delete(id: string): Promise<void>
}

export class MemoryProfileRepository implements ProfileRepository {
  private profiles: ConnectionProfile[]

  constructor(seed: ConnectionProfile[]) {
    this.profiles = seed
  }

  async list(): Promise<ConnectionProfile[]> {
    return [...this.profiles]
  }

  async create(input: CreateProfileInput): Promise<ConnectionProfile> {
    const id = globalThis.crypto?.randomUUID?.() ?? `profile-${Date.now()}`
    const profile: ConnectionProfile =
      input.type === 'ssh'
        ? {
            id,
            type: 'ssh',
            name: input.name,
            host: input.host,
            port: input.port,
            username: input.username,
            authType: 'password',
            group: input.group,
            sftpEnabled: true,
            remotePath: '/srv/www'
          }
        : {
            id,
            type: 'ftp',
            name: input.name,
            host: input.host,
            port: input.port,
            username: input.username,
            secure: false,
            group: input.group,
            remotePath: '/incoming'
          }

    this.profiles = [profile, ...this.profiles]
    return profile
  }

  async getById(id: string): Promise<ConnectionProfile | null> {
    return this.profiles.find((profile) => profile.id === id) ?? null
  }

  async delete(id: string): Promise<void> {
    this.profiles = this.profiles.filter((profile) => profile.id !== id)
  }
}
