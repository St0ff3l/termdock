import { randomUUID } from 'node:crypto'
import type { TransferTask } from '@termdock/core'

export class WorkspaceTransfersState {
  private readonly transfers: TransferTask[]

  constructor(seedTransfers: TransferTask[]) {
    this.transfers = [...seedTransfers]
  }

  list() {
    return [...this.transfers]
  }

  queueUploads(fileNames: string[]) {
    const queued = fileNames.map((name, index) => ({
      id: randomUUID(),
      direction: 'upload' as const,
      name,
      progress: index === 0 ? 12 : 0,
      status: index === 0 ? 'running' as const : 'queued' as const
    }))

    this.transfers.unshift(...queued)
  }

  add(direction: TransferTask['direction'], name: string) {
    const transferId = randomUUID()
    this.transfers.unshift({
      id: transferId,
      direction,
      name,
      progress: 0,
      status: 'running'
    })
    return transferId
  }

  update(
    transferId: string,
    patch: Partial<Pick<TransferTask, 'progress' | 'status' | 'message' | 'speed'>>
  ) {
    const index = this.transfers.findIndex((transfer) => transfer.id === transferId)
    if (index === -1) {
      return
    }

    const current = this.transfers[index]
    if (
      (current.status === 'done' || current.status === 'failed' || current.status === 'canceled')
      && (patch.status === 'running' || patch.status === 'queued')
    ) {
      return
    }

    this.transfers[index] = {
      ...current,
      ...patch
    }
  }

  get(transferId: string) {
    return this.transfers.find((transfer) => transfer.id === transferId)
  }
}
