import type { Declaration } from 'postcss'

const PX_RE = /(-?\d*\.?\d+)px\b/g
const NON_SCALING_PROPERTY_RE = /^(?:border|outline|box-shadow|text-shadow)/

export const responsivePx = () => ({
  postcssPlugin: 'postcss-responsive-px',
  Declaration(declaration: Declaration) {
    const file = declaration.source?.input.file || ''

    if (!file.includes('/app/')) return
    if (NON_SCALING_PROPERTY_RE.test(declaration.prop)) return
    if (!declaration.value.includes('px') || declaration.value.includes('clamp(')) return

    declaration.value = declaration.value.replace(PX_RE, (_match, rawValue: string) => {
      const value = Number(rawValue)

      if (value === 0) return '0px'

      const min = value * 0.75
      const max = value * 2.45

      return `clamp(${min}px, calc(${value} / 430 * 100vw), ${max}px)`
    })
  }
})
