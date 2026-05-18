export function AppIcon({
  name,
  size = 14
}: {
  name: 'grid' | 'menu' | 'server' | 'connections' | 'folder' | 'file' | 'history' | 'refresh' | 'upload' | 'download' | 'flash'
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
      {name === 'flash' ? (
        <path {...commonProps} d="M8.9 1.8 3.8 8h3l-.7 6.2L12.2 8h-3.1l-.2-6.2Z" />
      ) : null}
    </svg>
  )
}
