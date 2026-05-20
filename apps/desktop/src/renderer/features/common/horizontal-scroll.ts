import type { WheelEvent } from 'react'

function normalizeWheelDelta(event: WheelEvent<HTMLElement>, delta: number, width: number) {
  if (event.deltaMode === 1) {
    return delta * 16
  }
  if (event.deltaMode === 2) {
    return delta * width
  }
  return delta
}

export function handleHorizontalWheelScroll(event: WheelEvent<HTMLElement>) {
  const container = event.currentTarget
  const maxScrollLeft = container.scrollWidth - container.clientWidth
  if (maxScrollLeft <= 0) {
    return
  }

  const primaryDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
  if (primaryDelta === 0) {
    return
  }

  const scrollDelta = normalizeWheelDelta(event, primaryDelta, container.clientWidth)
  const previousLeft = container.scrollLeft
  const nextLeft = Math.max(0, Math.min(maxScrollLeft, previousLeft + scrollDelta))
  if (nextLeft === previousLeft) {
    return
  }

  container.scrollLeft = nextLeft
  event.preventDefault()
}
