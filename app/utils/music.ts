const MUSIC_ENABLED_KEY = 'musicEnabled'

export const getMusicEnabled = () => {
  if (typeof localStorage === 'undefined') return true

  return localStorage.getItem(MUSIC_ENABLED_KEY) !== '0'
}

export const saveMusicEnabled = (enabled: boolean) => {
  if (typeof localStorage === 'undefined') return

  localStorage.setItem(MUSIC_ENABLED_KEY, enabled ? '1' : '0')
}
