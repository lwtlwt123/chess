import { useRuntimeConfig } from '#app'

const ABSOLUTE_URL_RE = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i
const INLINE_URL_RE = /^(?:blob|data):/i
const CHESS_ASSET_ROOT = '/chessPrice'

const trimEndSlash = (value: string) => value.replace(/\/+$/, '')

const normalizePath = (path: string) => {
  const trimmedPath = path.trim()

  if (!trimmedPath) return ''
  return trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
}

export const resolveAssetUrl = (path: string, baseUrl = '') => {
  const trimmedPath = path.trim()

  if (!trimmedPath) return ''
  if (ABSOLUTE_URL_RE.test(trimmedPath) || INLINE_URL_RE.test(trimmedPath)) return trimmedPath

  const assetPath = normalizePath(trimmedPath)
  const normalizedBaseUrl = trimEndSlash(baseUrl.trim())

  if (!normalizedBaseUrl) return assetPath

  if (normalizedBaseUrl.endsWith(CHESS_ASSET_ROOT) && assetPath.startsWith(`${CHESS_ASSET_ROOT}/`)) {
    return `${normalizedBaseUrl}${assetPath.slice(CHESS_ASSET_ROOT.length)}`
  }

  return `${normalizedBaseUrl}${assetPath}`
}

export const toCssUrl = (url: string) => `url("${url.replace(/"/g, '\\"')}")`

export const useAssetUrl = () => {
  const config = useRuntimeConfig()
  const baseUrl = String(config.public.assetBaseUrl || '')

  return (path: string) => resolveAssetUrl(path, baseUrl)
}
