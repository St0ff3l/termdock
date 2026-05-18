import type { CommandFolder, CommandTemplate, ConnectionProfile, TransferTask } from '@termdock/core'

export const seedProfiles: ConnectionProfile[] = [
  {
    id: 'profile-ssh-prod',
    type: 'ssh',
    name: 'prod-web-01',
    host: '10.0.0.21',
    port: 22,
    username: 'root',
    authType: 'privateKey',
    privateKeyPath: '~/.ssh/id_ed25519',
    group: 'Production',
    sftpEnabled: true,
    remotePath: '/srv/www'
  },
  {
    id: 'profile-ssh-nas',
    type: 'ssh',
    name: 'nas-storage',
    host: '10.0.0.44',
    port: 22,
    username: 'admin',
    authType: 'password',
    group: 'Staging',
    sftpEnabled: true,
    remotePath: '/volume1'
  },
  {
    id: 'profile-ftp-archive',
    type: 'ftp',
    name: 'archive-ftp',
    host: 'ftp.example.net',
    port: 21,
    username: 'deploy',
    secure: false,
    group: 'FTP Sites',
    remotePath: '/incoming'
  }
]

export const seedTransfers: TransferTask[] = []

export const seedCommandFolders: CommandFolder[] = [
  {
    id: 'cmd-folder-default',
    type: 'command-folder',
    name: '默认分类',
    order: 1000
  },
  {
    id: 'cmd-folder-deploy',
    type: 'command-folder',
    name: '部署运维',
    order: 2000
  }
]

export const seedCommandTemplates: CommandTemplate[] = [
  {
    id: 'cmd-docker-ps',
    type: 'command-template',
    name: '容器状态',
    parentId: 'cmd-folder-default',
    order: 1000,
    command: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
    description: '查看当前容器运行状态',
    appendCarriageReturn: true
  },
  {
    id: 'cmd-tail-log',
    type: 'command-template',
    name: 'Tail 日志',
    parentId: 'cmd-folder-default',
    order: 2000,
    command: 'tail -f [p#1]',
    description: '传入日志文件路径并实时查看输出',
    appendCarriageReturn: true
  },
  {
    id: 'cmd-restart-service',
    type: 'command-template',
    name: '重启服务',
    parentId: 'cmd-folder-deploy',
    order: 1000,
    command: 'systemctl restart [p#1]',
    description: '按服务名执行重启',
    appendCarriageReturn: true
  }
]
