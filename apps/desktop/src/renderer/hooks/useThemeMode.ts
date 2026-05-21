import { useEffect } from 'react'

export type ThemeMode = 'default-dark' | 'default-light'

export function useThemeMode(themeName: ThemeMode = 'default-dark') {
  useEffect(() => {
    document.documentElement.dataset.theme = themeName
    document.documentElement.style.colorScheme = themeName === 'default-light' ? 'light' : 'dark'
    return () => {
      if (document.documentElement.dataset.theme === themeName) {
        delete document.documentElement.dataset.theme
      }
      if (document.documentElement.style.colorScheme === (themeName === 'default-light' ? 'light' : 'dark')) {
        document.documentElement.style.removeProperty('color-scheme')
      }
    }
  }, [themeName])
}
